import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import type { DocumentReference } from 'firebase/firestore';
import type { InviteDoc } from '../src/types/models';

// Mock useInvites so we can supply incoming invites and assert that the
// accept/decline actions are invoked with the right arguments.
const { useIncomingInvites, acceptInvite, declineInvite } = vi.hoisted(() => ({
  useIncomingInvites: vi.fn(),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
}));

vi.mock('../src/hooks/useInvites', () => ({
  useIncomingInvites: (...args: unknown[]) => useIncomingInvites(...args),
  acceptInvite: (...args: unknown[]) => acceptInvite(...args),
  declineInvite: (...args: unknown[]) => declineInvite(...args),
}));

import PendingInvites from '../src/features/invites/PendingInvites';

type IncomingInvite = InviteDoc & { id: string; ref: DocumentReference };

const user: User = {
  uid: 'u2',
  email: 'invitee@example.com',
  displayName: 'Invitee Two',
} as unknown as User;

function makeInvite(overrides: Partial<IncomingInvite> = {}): IncomingInvite {
  return {
    id: 'invitee@example.com',
    email: 'invitee@example.com',
    invitedByUid: 'owner1',
    invitedByName: 'Owner One',
    groupName: 'Our Household',
    status: 'pending',
    createdAt: {} as InviteDoc['createdAt'],
    ref: {
      path: 'groups/g1/invites/invitee@example.com',
    } as unknown as DocumentReference,
    ...overrides,
  };
}

describe('PendingInvites', () => {
  beforeEach(() => {
    useIncomingInvites.mockReset().mockReturnValue({ invites: [] });
    acceptInvite.mockReset().mockResolvedValue(undefined);
    declineInvite.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing when there are no pending invites', () => {
    const { container } = render(<PendingInvites user={user} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the group name and inviter for each pending invite', () => {
    useIncomingInvites.mockReturnValue({
      invites: [
        makeInvite({ groupName: 'Our Household', invitedByName: 'Owner One' }),
      ],
    });

    render(<PendingInvites user={user} />);

    expect(screen.getByText(/Our Household/)).toBeInTheDocument();
    expect(screen.getByText(/Owner One/)).toBeInTheDocument();
  });

  it('renders two invites with the same email as independent rows', () => {
    const inviteA = makeInvite({
      groupName: 'Group A',
      ref: {
        path: 'groups/gA/invites/invitee@example.com',
      } as unknown as DocumentReference,
    });
    const inviteB = makeInvite({
      groupName: 'Group B',
      ref: {
        path: 'groups/gB/invites/invitee@example.com',
      } as unknown as DocumentReference,
    });
    useIncomingInvites.mockReturnValue({ invites: [inviteA, inviteB] });

    render(<PendingInvites user={user} />);

    expect(screen.getByText(/Group A/)).toBeInTheDocument();
    expect(screen.getByText(/Group B/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /accept/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /decline/i })).toHaveLength(2);
  });

  it('calls acceptInvite with the invite and user when Accept is clicked', async () => {
    const invite = makeInvite();
    useIncomingInvites.mockReturnValue({ invites: [invite] });

    const u = userEvent.setup();
    render(<PendingInvites user={user} />);

    await u.click(screen.getByRole('button', { name: /accept/i }));

    expect(acceptInvite).toHaveBeenCalledWith(invite, user);
  });

  it('calls declineInvite with the invite when Decline is clicked', async () => {
    const invite = makeInvite();
    useIncomingInvites.mockReturnValue({ invites: [invite] });

    const u = userEvent.setup();
    render(<PendingInvites user={user} />);

    await u.click(screen.getByRole('button', { name: /decline/i }));

    expect(declineInvite).toHaveBeenCalledWith(invite);
  });
});
