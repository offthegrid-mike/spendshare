import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import NewTripForm from './NewTripForm';

const { createTrip } = vi.hoisted(() => ({ createTrip: vi.fn() }));
vi.mock('../../lib/travel/createTrip', () => ({ createTrip }));
// A plain input stands in for the calendar popover.
vi.mock('../expenses/DatePicker', () => ({
  default: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const user = { uid: 'mike', email: 'mike@example.com' } as User;
const onCreated = vi.fn();

beforeEach(() => {
  createTrip.mockReset().mockResolvedValue('trip-1');
  onCreated.mockReset();
});

async function fill(name: string, start: string, end: string) {
  const u = userEvent.setup();
  if (name) await u.type(screen.getByLabelText('Trip name'), name);
  if (start) await u.type(screen.getByLabelText('First day'), start);
  if (end) await u.type(screen.getByLabelText('Last day'), end);
  await u.click(screen.getByRole('button', { name: 'Create trip' }));
}

describe('NewTripForm', () => {
  it('creates the trip in the default home currency and hands back its id', async () => {
    render(<NewTripForm user={user} defaultCurrency="GBP" onCreated={onCreated} />);
    await fill('Japan', '2027-05-10', '2027-05-20');
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('trip-1'));
    expect(createTrip).toHaveBeenCalledWith(user, {
      name: 'Japan', currency: 'GBP', startDate: '2027-05-10', endDate: '2027-05-20',
    });
  });

  it('explains the home currency', () => {
    render(<NewTripForm user={user} defaultCurrency="AUD" onCreated={onCreated} />);
    expect(screen.getByText(/Balances and settle-up are worked out in this currency/)).toBeInTheDocument();
  });

  it('shows what is wrong instead of creating an invalid trip', async () => {
    render(<NewTripForm user={user} defaultCurrency="AUD" onCreated={onCreated} />);
    await fill('Japan', '2027-05-10', '2027-05-01');
    expect(await screen.findByText('The last day can’t be before the first.')).toBeInTheDocument();
    expect(createTrip).not.toHaveBeenCalled();
  });

  it('shows an error and lets the user try again when saving fails', async () => {
    createTrip.mockRejectedValue(new Error('offline'));
    render(<NewTripForm user={user} defaultCurrency="AUD" onCreated={onCreated} />);
    await fill('Japan', '2027-05-10', '2027-05-20');
    expect(await screen.findByText("Couldn't create the trip. Try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
