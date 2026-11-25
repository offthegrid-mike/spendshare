import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripCash from './TripCash';
import { tripCash } from '../../lib/travel/cash';
import { makeExpense, makeTrip } from '../../test/fixtures';
import type { TopUpDoc, WalletDoc } from '../../types/models';
import { useUIStore } from '../../stores/uiStore';

const { addCash, deleteTopUp } = vi.hoisted(() => ({ addCash: vi.fn(), deleteTopUp: vi.fn() }));
vi.mock('./cashWrite', () => ({ addCash, deleteTopUp }));
vi.mock('../expenses/DatePicker', () => ({
  default: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const alex = { uid: 'alex' } as User;
const alexYen: WalletDoc = { id: 'alex_JPY', kind: 'personal', ownerUid: 'alex', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
const topUps: TopUpDoc[] = [
  { id: 't1', walletId: 'alex_JPY', byUid: 'alex', date: '2027-05-08', foreignAmount: 50000, homeAmount: 50000, createdAt: null as never },
  { id: 't2', walletId: 'alex_JPY', byUid: 'alex', date: '2027-05-11', foreignAmount: 50000, homeAmount: 53000, createdAt: null as never },
];
const dinner = makeExpense('dinner', { currency: 'JPY', total: 60000, payerUid: 'alex', paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });

function renderCash(wallets = [alexYen], ups = topUps, expenses = [dinner]) {
  return render(
    <MemoryRouter>
      <TripCash trip={trip} user={alex} cash={tripCash(wallets, ups, expenses)} expenses={expenses} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addCash.mockReset().mockResolvedValue(undefined);
  deleteTopUp.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 4, 12, 9));
});
afterEach(() => vi.useRealTimers());

describe('TripCash', () => {
  it('shows each wallet’s cash left, what it cost, and its average rate (example A)', () => {
    renderCash();
    const card = screen.getByRole('region', { name: 'Your JPY cash' });
    expect(card).toHaveTextContent('¥40,000 left');
    expect(card).toHaveTextContent('Cost A$412.00');
    expect(card).toHaveTextContent('Average 1 AUD = 97.09 JPY');
    expect(card).toHaveTextContent('Bought ¥100,000 for A$1,030.00 · Spent ¥60,000');
    const added = within(card).getAllByRole('listitem');
    expect(added.map((li) => li.textContent)).toEqual([
      expect.stringContaining('¥50,000 for A$500.00'),
      expect.stringContaining('¥50,000 for A$530.00'),
    ]);
  });

  it('adds cash to the viewer’s wallet in a currency, showing the rate it works out to', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash([], [], []);
    expect(screen.getByText('No cash yet')).toBeInTheDocument();
    await u.click(screen.getByRole('combobox', { name: 'Currency' }));
    await u.click(screen.getByRole('option', { name: /^JPY/ }));
    await u.type(screen.getByLabelText('Cash received (JPY)'), '50,000');
    await u.type(screen.getByLabelText('You paid (AUD)'), '500');
    expect(screen.getByText('1 AUD = 100 JPY')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Add cash' }));
    await waitFor(() => expect(addCash).toHaveBeenCalledWith({
      tripId: 'japan', uid: 'alex', ownerUid: 'alex', currency: 'JPY',
      foreignAmount: 50000, homeAmount: 50000, date: '2027-05-12', walletExists: false,
    }));
  });

  it('adds to an existing wallet without creating it again', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash();
    await u.type(screen.getByLabelText('Cash received (JPY)'), '10000');
    await u.type(screen.getByLabelText('You paid (AUD)'), '103');
    await u.click(screen.getByRole('button', { name: 'Add cash' }));
    await waitFor(() => expect(addCash).toHaveBeenCalledWith(expect.objectContaining({ ownerUid: 'alex', currency: 'JPY', walletExists: true })));
  });

  it('can keep cash for someone else on the trip', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash();
    await u.click(screen.getByRole('combobox', { name: 'Whose cash' }));
    await u.click(screen.getByRole('option', { name: 'Ben' }));
    expect(screen.getByLabelText('Ben paid (AUD)')).toBeInTheDocument();
  });

  it('refuses no cash, or a cash amount that is not a number', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash();
    await u.type(screen.getByLabelText('You paid (AUD)'), '100');
    await u.click(screen.getByRole('button', { name: 'Add cash' }));
    expect(await screen.findByText('Enter the cash you received.')).toBeInTheDocument();
    expect(addCash).not.toHaveBeenCalled();
  });

  it('removes cash added by mistake, after confirming', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash();
    await u.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    expect(deleteTopUp).not.toHaveBeenCalled();
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(deleteTopUp).toHaveBeenCalledWith('japan', 't1'));
  });

  it('says so when removing cash fails', async () => {
    deleteTopUp.mockRejectedValue(new Error('denied'));
    useUIStore.setState({ notice: null });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCash();
    await u.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(useUIStore.getState().notice?.message).toBe("Couldn't remove that cash. Try again."));
  });

  it('flags a wallet that has paid out more than was put in, or has no cash added', () => {
    renderCash([alexYen], [topUps[0]], [{ ...dinner }]);
    expect(screen.getByRole('region', { name: 'Your JPY cash' })).toHaveTextContent('¥10,000 more spent than added');
    const { unmount } = renderCash([{ ...alexYen, id: 'ben_JPY', ownerUid: 'ben' }], [], [{ ...dinner, paidWith: { kind: 'wallet', walletId: 'ben_JPY' } }]);
    expect(screen.getByRole('region', { name: 'Ben’s JPY cash' })).toHaveTextContent('Add the cash Ben bought, so its payments can be valued.');
    unmount();
  });
});
