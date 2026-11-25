import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import TripSettings from './TripSettings';
import { makeTrip } from '../../test/fixtures';

const { updateDoc } = vi.hoisted(() => ({ updateDoc: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  updateDoc,
  doc: (_c: unknown, id: string) => ({ id }),
  serverTimestamp: () => 'TS',
  arrayUnion: (v: unknown) => ({ arrayUnion: v }),
  arrayRemove: (v: unknown) => ({ arrayRemove: v }),
  deleteField: () => 'DELETE',
  Timestamp: { now: () => 'NOW' },
}));
vi.mock('../../lib/converters', () => ({ groupsCol: {} }));
vi.mock('../invites/SendInvite', () => ({
  default: ({ group }: { group: { id: string; kind?: string } }) => <div data-testid="send-invite" data-kind={group.kind} />,
}));
vi.mock('../expenses/DatePicker', () => ({
  default: ({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20');
const owner = { uid: 'mike', email: 'mike@example.com', displayName: 'Mike' } as User;
const member = { uid: 'priya', email: 'priya@example.com', displayName: 'Priya' } as User;

beforeEach(() => {
  updateDoc.mockReset().mockResolvedValue(undefined);
});

describe('TripSettings', () => {
  it('lets the owner change the name and dates', async () => {
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={owner} />);
    const end = screen.getByLabelText('Last day');
    await u.clear(end);
    await u.type(end, '2027-05-22');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, {
      name: 'Japan', trip: { startDate: '2027-05-10', endDate: '2027-05-22' },
    }));
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it('does not save invalid dates', async () => {
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={owner} />);
    const end = screen.getByLabelText('Last day');
    await u.clear(end);
    await u.type(end, '2027-05-01');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('The last day can’t be before the first.')).toBeInTheDocument();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('shows another member the dates without letting them change them, and saves only the name', async () => {
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={member} />);
    expect(screen.queryByLabelText('First day')).not.toBeInTheDocument();
    expect(screen.getByText('10–20 May 2027')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { name: 'Japan' }));
  });

  it('saves only the name when the owner leaves the dates alone, so newer dates are not overwritten', async () => {
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={owner} />);
    await u.type(screen.getByLabelText('Trip name'), ' 2027');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { name: 'Japan 2027' }));
  });

  it('lets another member rename a trip that has no dates', async () => {
    const u = userEvent.setup();
    const undated = { ...trip, trip: undefined };
    render(<TripSettings trip={undated} user={member} />);
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { name: 'Japan' }));
  });

  it('shows the home currency, which cannot change once the trip exists', () => {
    render(<TripSettings trip={trip} user={owner} />);
    expect(screen.getByText('Home currency')).toBeInTheDocument();
    expect(screen.getByText('AUD')).toBeInTheDocument();
  });

  it('lists the members and lets them invite people to the trip', () => {
    render(<TripSettings trip={trip} user={owner} />);
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByTestId('send-invite')).toHaveAttribute('data-kind', 'trip');
  });

  it('does not wait for the server while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updateDoc.mockReturnValue(new Promise(() => {}));
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={owner} />);
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
    await u.type(screen.getByPlaceholderText('e.g. Jane Smith'), 'Sam');
    await u.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Jane Smith')).toHaveValue(''));
    vi.restoreAllMocks();
  });

  it('lets the owner close the trip after confirming, and reopen it', async () => {
    const u = userEvent.setup();
    const { unmount } = render(<TripSettings trip={trip} user={owner} />);
    await u.click(screen.getByRole('button', { name: 'Close trip' }));
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close trip' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { tripClosedAt: 'NOW' }));
    unmount();
    render(<TripSettings trip={{ ...trip, tripClosedAt: { toDate: () => new Date(2027, 4, 21) } as never }} user={owner} />);
    expect(screen.getByText('Closed on 21 May 2027. Nothing on the trip can change; settle-up still works.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Reopen trip' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { tripClosedAt: 'DELETE' }));
  });

  it('closes at once on this device, with a client time, so nothing can be added while the close waits to sync', async () => {
    const u = userEvent.setup();
    render(<TripSettings trip={trip} user={owner} />);
    await u.click(screen.getByRole('button', { name: 'Close trip' }));
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close trip' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith({ id: 'japan' }, { tripClosedAt: 'NOW' }));
  });

  it('doesn’t let a closed trip’s name or dates change', () => {
    render(<TripSettings trip={{ ...trip, tripClosedAt: { toDate: () => new Date(2027, 4, 21) } as never }} user={owner} />);
    expect(screen.getByLabelText('Trip name')).toBeDisabled();
    expect(screen.getByLabelText('First day')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('offers closing only to the owner', () => {
    render(<TripSettings trip={trip} user={member} />);
    expect(screen.queryByRole('button', { name: 'Close trip' })).not.toBeInTheDocument();
  });
});
