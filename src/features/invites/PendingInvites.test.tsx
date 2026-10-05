import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import PendingInvites from './PendingInvites';
import { useUIStore } from '../../stores/uiStore';

const { acceptInvite, declineInvite } = vi.hoisted(() => ({ acceptInvite: vi.fn(), declineInvite: vi.fn() }));
const invite = {
  ref: { path: 'groups/g9/invites/mike@example.com', parent: { parent: { id: 'g9' } } },
  invitedByName: 'Priya',
  groupName: 'Tasmania trip',
};
vi.mock('../../hooks/useInvites', () => ({
  useIncomingInvites: () => ({ invites: [invite] }),
  acceptInvite,
  declineInvite,
}));

const user = { uid: 'mike', email: 'mike@example.com' } as unknown as User;

beforeEach(() => {
  acceptInvite.mockReset().mockResolvedValue(undefined);
  useUIStore.setState({ selectedGroupId: 'g1', pendingGroupId: null, notice: null });
});

describe('PendingInvites', () => {
  it('selects the joined group once it arrives and says so', async () => {
    render(<PendingInvites user={user} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(useUIStore.getState().pendingGroupId).toBe('g9'));
    expect(useUIStore.getState().selectedGroupId).toBe('g1');
    expect(useUIStore.getState().notice?.message).toBe('You joined Tasmania trip');
  });

  it('changes nothing when accepting fails', async () => {
    acceptInvite.mockRejectedValue(new Error('denied'));
    render(<PendingInvites user={user} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('Could not accept invite.')).toBeInTheDocument();
    expect(useUIStore.getState().pendingGroupId).toBeNull();
    expect(useUIStore.getState().notice).toBeNull();
  });
});
