import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import type { InviteDoc } from '../src/types/models';

// Mock the useInvites hook so we can assert on its exposed functions
// without touching Firestore. Each function is a vi.fn() we can inspect.
const { sendInvite, revokeInvite, useOutgoingInvites } = vi.hoisted(() => ({
  sendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  useOutgoingInvites: vi.fn(),
}));

vi.mock('../src/hooks/useInvites', () => ({
  sendInvite: (...args: unknown[]) => sendInvite(...args),
  revokeInvite: (...args: unknown[]) => revokeInvite(...args),
  useOutgoingInvites: (...args: unknown[]) => useOutgoingInvites(...args),
}));

import SendInvite from '../src/features/invites/SendInvite';

type OutgoingInvite = InviteDoc & { id: string };

const user: User = {
  uid: 'owner1',
  email: 'owner@example.com',
  displayName: 'Owner One',
} as unknown as User;

const group = { id: 'g1', name: 'Our Household' };

function getEmailInput() {
  return screen.getByLabelText(/email/i);
}

describe('SendInvite', () => {
  beforeEach(() => {
    sendInvite.mockReset().mockResolvedValue(undefined);
    revokeInvite.mockReset().mockResolvedValue(undefined);
    useOutgoingInvites.mockReset().mockReturnValue({ invites: [] });
  });

  it('renders an email input and the helper note', () => {
    render(<SendInvite user={user} group={group} />);
    expect(getEmailInput()).toBeInTheDocument();
    expect(
      screen.getByText(/invite the exact email they'll sign in with/i),
    ).toBeInTheDocument();
  });

  it('submits a lowercased email with the group context', async () => {
    const u = userEvent.setup();
    render(<SendInvite user={user} group={group} />);

    await u.type(getEmailInput(), 'Friend@Example.com');
    await u.click(screen.getByRole('button', { name: /invite|send/i }));

    expect(sendInvite).toHaveBeenCalledWith({
      gid: 'g1',
      email: 'friend@example.com',
      invitedByUid: 'owner1',
      invitedByName: 'Owner One',
      groupName: 'Our Household',
    });
  });

  it('shows an error message when sendInvite rejects', async () => {
    sendInvite.mockRejectedValue(new Error('permission-denied'));
    const u = userEvent.setup();
    render(<SendInvite user={user} group={group} />);

    await u.type(getEmailInput(), 'friend@example.com');
    await u.click(screen.getByRole('button', { name: /invite|send/i }));

    expect(
      await screen.findByText(/failed to send invite/i),
    ).toBeInTheDocument();
  });

  it('does not call sendInvite when the email is empty', async () => {
    const u = userEvent.setup();
    render(<SendInvite user={user} group={group} />);

    await u.click(screen.getByRole('button', { name: /invite|send/i }));

    expect(sendInvite).not.toHaveBeenCalled();
  });

  it('renders the list of outgoing invites with their status', () => {
    const invites: OutgoingInvite[] = [
      {
        id: 'alice@example.com',
        email: 'alice@example.com',
        invitedByUid: 'owner1',
        invitedByName: 'Owner One',
        groupName: 'Our Household',
        status: 'pending',
        createdAt: {} as InviteDoc['createdAt'],
      },
      {
        id: 'bob@example.com',
        email: 'bob@example.com',
        invitedByUid: 'owner1',
        invitedByName: 'Owner One',
        groupName: 'Our Household',
        status: 'accepted',
        createdAt: {} as InviteDoc['createdAt'],
      },
    ];
    useOutgoingInvites.mockReturnValue({ invites });

    render(<SendInvite user={user} group={group} />);

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
  });

  it('calls revokeInvite when Revoke is clicked on a pending invite', async () => {
    const invites: OutgoingInvite[] = [
      {
        id: 'alice@example.com',
        email: 'alice@example.com',
        invitedByUid: 'owner1',
        invitedByName: 'Owner One',
        groupName: 'Our Household',
        status: 'pending',
        createdAt: {} as InviteDoc['createdAt'],
      },
    ];
    useOutgoingInvites.mockReturnValue({ invites });

    const u = userEvent.setup();
    render(<SendInvite user={user} group={group} />);

    await u.click(screen.getByRole('button', { name: /revoke/i }));

    expect(revokeInvite).toHaveBeenCalledWith('g1', 'alice@example.com');
  });
});
