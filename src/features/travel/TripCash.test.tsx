import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripCash from './TripCash';
import { tripCash } from '../../lib/travel/cash';
import { makeExpense, makeTrip } from '../../test/fixtures';
import type { HandoverDoc, TopUpDoc, WalletDoc } from '../../types/models';
import { useUIStore } from '../../stores/uiStore';

const { addCash, deleteTopUp, setKittyKeeper } = vi.hoisted(() => ({ addCash: vi.fn(), deleteTopUp: vi.fn(), setKittyKeeper: vi.fn() }));
vi.mock('./cashWrite', () => ({ addCash, deleteTopUp, setKittyKeeper }));
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

function renderCash(wallets = [alexYen], ups = topUps, expenses = [dinner], handovers: HandoverDoc[] = []) {
  return render(
    <MemoryRouter>
      <TripCash trip={trip} user={alex} cash={tripCash(wallets, ups, expenses, handovers)} expenses={expenses} />
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

  it('offers no changes on a closed trip', () => {
    const closed = { ...trip, tripClosedAt: { toDate: () => new Date() } as never };
    render(
      <MemoryRouter>
        <TripCash trip={closed} user={alex} cash={tripCash([alexYen], topUps, [dinner])} expenses={[dinner]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('form', { name: 'Add cash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('lists cash handed to or received from others', () => {
    const ben: WalletDoc = { ...alexYen, id: 'ben_JPY', ownerUid: 'ben' };
    render(
      <MemoryRouter>
        <TripCash trip={trip} user={alex} expenses={[dinner]}
          cash={tripCash([alexYen, ben], topUps, [dinner], [
            { id: 'h1', fromUid: 'alex', toUid: 'ben', currency: 'JPY', foreignAmount: 5000, date: '2027-05-13', byUid: 'alex', createdAt: null as never },
          ])} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: 'Your JPY cash' })).toHaveTextContent('13 May · gave ¥5,000 to Ben');
    expect(screen.getByRole('region', { name: 'Ben’s JPY cash' })).toHaveTextContent('13 May · got ¥5,000 from you');
  });

  it('flags a wallet that has paid out more than was put in, or has no cash added', () => {
    renderCash([alexYen], [topUps[0]], [{ ...dinner }]);
    expect(screen.getByRole('region', { name: 'Your JPY cash' })).toHaveTextContent('¥10,000 more spent than added');
    const { unmount } = renderCash([{ ...alexYen, id: 'ben_JPY', ownerUid: 'ben' }], [], [{ ...dinner, paidWith: { kind: 'wallet', walletId: 'ben_JPY' } }]);
    expect(screen.getByRole('region', { name: 'Ben’s JPY cash' })).toHaveTextContent('Add the cash Ben bought, so its payments can be valued.');
    unmount();
  });

  describe('the kitty (example B)', () => {
    const kitty: WalletDoc = { id: 'kitty_JPY', kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
    const put = (id: string, fromUid: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
      id, walletId: 'kitty_JPY', byUid: 'alex', fromUid, date: '2027-05-09', foreignAmount, homeAmount, createdAt: null as never,
    });
    const ups = [put('a', 'alex', 30000, 30000), put('b', 'ben', 30000, 30000), put('c', 'chris', 40000, 42000)];
    const spent = [
      makeExpense('d', { currency: 'JPY', total: 50000, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } }),
      makeExpense('m', { currency: 'JPY', total: 30000, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } }),
    ];

    it('shows what each person put in and the cash they get back', () => {
      renderCash([kitty], ups, spent);
      const card = screen.getByRole('region', { name: 'Kitty · JPY' });
      expect(card).toHaveTextContent('¥20,000 left');
      const people = within(within(card).getByRole('list', { name: 'Put in' })).getAllByRole('listitem').map((li) => li.textContent);
      expect(people).toEqual([
        'You put in ¥30,000 for A$300.00 · get back ¥6,000',
        'Ben put in ¥30,000 for A$300.00 · gets back ¥6,000',
        'Chris put in ¥40,000 for A$420.00 · gets back ¥8,000',
      ]);
    });

    it('lets one person keep what’s left instead of handing it back', async () => {
      setKittyKeeper.mockResolvedValue(undefined);
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCash([kitty], ups, spent);
      const card = within(screen.getByRole('region', { name: 'Kitty · JPY' }));
      expect(card.getByRole('combobox', { name: 'What’s left' })).toHaveTextContent('Hand it back');
      await u.click(card.getByRole('combobox', { name: 'What’s left' }));
      await u.click(screen.getByRole('option', { name: 'Chris keeps it' }));
      await waitFor(() => expect(setKittyKeeper).toHaveBeenCalledWith('japan', 'kitty_JPY', 'chris'));
    });

    it('shows who keeps what’s left', () => {
      renderCash([{ ...kitty, keptBy: 'chris' }], ups, spent);
      const card = screen.getByRole('region', { name: 'Kitty · JPY' });
      expect(card).toHaveTextContent('Chris put in ¥40,000 for A$420.00 · keeps ¥20,000');
    });

    it('puts money into the kitty for someone', async () => {
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderCash([kitty], ups, spent);
      await u.click(screen.getByRole('combobox', { name: 'Whose cash' }));
      await u.click(screen.getByRole('option', { name: 'The kitty (shared)' }));
      await u.click(screen.getByRole('combobox', { name: 'Put in by' }));
      await u.click(screen.getByRole('option', { name: 'Ben' }));
      await u.type(screen.getByLabelText('Cash received (JPY)'), '10000');
      await u.type(screen.getByLabelText('Ben paid (AUD)'), '102');
      await u.click(screen.getByRole('button', { name: 'Add cash' }));
      await waitFor(() => expect(addCash).toHaveBeenCalledWith({
        tripId: 'japan', uid: 'alex', kitty: true, fromUid: 'ben', currency: 'JPY',
        foreignAmount: 10000, homeAmount: 10200, date: '2027-05-12', walletExists: true,
      }));
    });
  });
});

describe('TripCash hand-overs', () => {
  it('shows cash handed over apart from what was bought and spent', () => {
    const h: HandoverDoc = { id: 'h1', fromUid: 'alex', toUid: 'ben', currency: 'JPY', foreignAmount: 10000, date: '2027-05-12', byUid: 'alex', createdAt: null as never };
    renderCash([alexYen], topUps, [dinner], [h]);
    const card = screen.getByRole('region', { name: 'Your JPY cash' });
    expect(card).toHaveTextContent('Bought ¥100,000 for A$1,030.00 · Spent ¥60,000 · Handed over ¥10,000');
  });
});
