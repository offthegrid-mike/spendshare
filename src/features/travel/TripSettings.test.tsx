import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
}));
vi.mock('../../lib/converters', () => ({ groupsCol: {} }));
vi.mock('../invites/SendInvite', () => ({
  default: ({ group }: { group: { id: string; kind?: string } }) => <div data-testid="send-invite" data-kind={group.kind} />,
}));
vi.mock('../expenses/DatePicker', () => ({
  default: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20');
const owner = { uid: 'mike', email: 'mike@example.com', displayName: 'Mike' } as User;
const member = { uid: 'priya', email: 'priya@example.com', displayName: 'Priya' } as User;

beforeEach(() => updateDoc.mockReset().mockResolvedValue(undefined));

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
});
