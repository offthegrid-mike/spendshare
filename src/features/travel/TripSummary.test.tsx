import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripSummary from './TripSummary';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { ExpenseDoc, HandoverDoc, ItemDoc, SettlementDoc, TopUpDoc, WalletDoc } from '../../types/models';
import { tripCash } from '../../lib/travel/cash';

const { markSettlementPaid, undoSettlement } = vi.hoisted(() => ({
  markSettlementPaid: vi.fn(), undoSettlement: vi.fn(),
}));
vi.mock('../../lib/settle', () => ({ markSettlementPaid, undoSettlement }));
const { handOverCash, undoHandover } = vi.hoisted(() => ({ handOverCash: vi.fn(), undoHandover: vi.fn() }));
vi.mock('./cashWrite', () => ({ handOverCash, undoHandover }));
const { downloadCsv } = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('../../lib/work/downloadCsv', () => ({ downloadCsv }));
vi.mock('../../hooks/useCategories', () => ({ useCategories: () => ({ active: [], all: [], loading: false }) }));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const chris = { uid: 'chris' } as User;
// Worked example C: Ben pays ¥15,000 by card, shared by Ben and Chris, estimated at 1 A$ = ¥99.
const tax = makeExpense('tax', {
  shopName: 'Hotel tax', payerUid: 'ben', currency: 'JPY', total: 15000,
  paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
});
const taxItems = [makeItem('i1', 'tax', { amount: 15000, payerUid: 'ben', shared: true, sharedWith: ['ben', 'chris'], categoryId: 'acc', category: 'Accommodation' })];

function renderSummary(
  { expenses = [tax], items = { tax: taxItems } as Record<string, ItemDoc[]>, settlements = [] as SettlementDoc[] }:
  { expenses?: ExpenseDoc[]; items?: Record<string, ItemDoc[]>; settlements?: SettlementDoc[] } = {},
) {
  return render(
    <MemoryRouter>
      <TripSummary trip={trip} user={chris} expenses={expenses} itemsByExpense={items} settlements={settlements} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  handOverCash.mockReset().mockResolvedValue(undefined);
  undoHandover.mockReset().mockResolvedValue(undefined);
  markSettlementPaid.mockReset().mockResolvedValue(undefined);
  undoSettlement.mockReset().mockResolvedValue(undefined);
});

describe('TripSummary', () => {
  it('puts settle-up first: Chris pays Ben half the estimated tax', () => {
    renderSummary();
    const settle = screen.getByRole('region', { name: 'Settle up' });
    expect(within(settle).getByText('You → Ben')).toBeInTheDocument();
    expect(within(settle).getByText('A$75.76')).toBeInTheDocument();
  });

  it('warns that balances use estimated rates, linking to each payment', () => {
    renderSummary();
    const banner = screen.getByRole('region', { name: 'Estimated rates' });
    expect(banner).toHaveTextContent('1 card payment is still at an estimated rate.');
    expect(within(banner).getByRole('link', { name: /Hotel tax/ })).toHaveAttribute('href', '/travel/japan/expense/tax');
  });

  it('settles with the amount charged once it is entered, and drops the warning', () => {
    renderSummary({ expenses: [{ ...tax, paidWith: { kind: 'card', rate: 96.71, rateStatus: 'actual', homeTotal: 15510 } }] });
    expect(within(screen.getByRole('region', { name: 'Settle up' })).getByText('A$77.55')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Estimated rates' })).not.toBeInTheDocument();
  });

  it('marks a payment as paid for the trip', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(markSettlementPaid).toHaveBeenCalledWith(
      'japan', 'trip', { fromUid: 'chris', toUid: 'ben', amount: 7576 }, 'chris', [],
    ));
  });

  it('shows payments made, with undo, and all settled when nothing is left', async () => {
    const paid = { id: 'trip_chris_ben', month: 'trip', fromUid: 'chris', toUid: 'ben', amount: 7576, paid: true } as SettlementDoc;
    renderSummary({ settlements: [paid] });
    const settle = screen.getByRole('region', { name: 'Settle up' });
    expect(within(settle).getByText('All settled')).toBeInTheDocument();
    await userEvent.click(within(settle).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoSettlement).toHaveBeenCalledWith('japan', 'trip_chris_ben'));
  });

  it('shows each person’s balance, what they paid and their share', () => {
    renderSummary();
    const people = within(screen.getByRole('region', { name: 'Per person' }));
    const ben = people.getByRole('listitem', { name: 'Ben' });
    expect(ben).toHaveTextContent('Gets back A$75.76');
    expect(ben).toHaveTextContent('Paid for shared A$151.52 · Share A$75.76');
    expect(people.getByRole('listitem', { name: 'You' })).toHaveTextContent('You owe A$75.76');
    expect(people.getByRole('listitem', { name: 'Alex' })).toHaveTextContent('Settled');
  });

  it('shows only what each person paid for shared items beside their share', () => {
    const own = makeExpense('own', { payerUid: 'ben', currency: 'AUD', total: 800, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    renderSummary({ expenses: [tax, own], items: { tax: taxItems, own: [makeItem('o', 'own', { amount: 800, payerUid: 'ben', shared: false })] } });
    const ben = within(screen.getByRole('region', { name: 'Per person' })).getByRole('listitem', { name: 'Ben' });
    expect(ben).toHaveTextContent('Paid for shared A$151.52 · Share A$75.76');
  });

  it('totals the spending by category and by the currency paid in', () => {
    const taxi = makeExpense('taxi', { payerUid: 'alex', currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    renderSummary({
      expenses: [tax, taxi],
      items: { tax: taxItems, taxi: [makeItem('t', 'taxi', { amount: 2500, payerUid: 'alex', categoryId: 'tr', category: 'Transport' })] },
    });
    const spending = within(screen.getByRole('region', { name: 'Spending' }));
    expect(spending.getByText('≈ A$176.52')).toBeInTheDocument();
    expect(spending.getByRole('listitem', { name: 'Accommodation' })).toHaveTextContent('A$151.52');
    expect(spending.getByRole('listitem', { name: 'Paid in JPY' })).toHaveTextContent('¥15,000');
    expect(spending.getByRole('listitem', { name: 'Paid in AUD' })).toHaveTextContent('A$25.00');
  });

  it('names someone who has left the trip', () => {
    const gone = makeExpense('g', { payerUid: 'gone', currency: 'AUD', total: 900, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    renderSummary({ expenses: [gone], items: { g: [makeItem('gi', 'g', { amount: 900, payerUid: 'gone', shared: true, sharedWith: ['alex', 'chris', 'gone'] })] } });
    expect(within(screen.getByRole('region', { name: 'Settle up' })).getByText('You → A former member')).toBeInTheDocument();
  });

  it('still shows a payment marked paid after its expenses were deleted, so it can be undone or paid back', () => {
    const paid = { id: 'trip_chris_ben', month: 'trip', fromUid: 'chris', toUid: 'ben', amount: 7576, paid: true } as SettlementDoc;
    renderSummary({ expenses: [], items: {}, settlements: [paid] });
    const settle = within(screen.getByRole('region', { name: 'Settle up' }));
    expect(settle.getByText('Ben → You')).toBeInTheDocument();
    expect(settle.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('settles cash payments at their wallet’s value (example A)', () => {
    const dinner = makeExpense('dinner', { payerUid: 'alex', currency: 'JPY', total: 60000, paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });
    render(
      <MemoryRouter>
        <TripSummary
          trip={trip} user={chris} expenses={[dinner]} settlements={[]}
          cash={{ wallets: [], kitties: [], values: { dinner: 61800 } }}
          itemsByExpense={{ dinner: [makeItem('d', 'dinner', { amount: 60000, payerUid: 'alex', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] }}
        />
      </MemoryRouter>,
    );
    const settle = within(screen.getByRole('region', { name: 'Settle up' }));
    expect(settle.getByText('You → Alex')).toBeInTheDocument();
    expect(settle.getAllByText('A$206.00')).toHaveLength(2);
  });

  it('settles a kitty (example B): Alex and Ben each pay Chris A$83, and the cash left is handed back', () => {
    const kitty: WalletDoc = { id: 'kitty_JPY', kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
    const put = (id: string, fromUid: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
      id, walletId: 'kitty_JPY', byUid: 'alex', fromUid, date: '2027-05-09', foreignAmount, homeAmount, createdAt: null as never,
    });
    const d = makeExpense('d', { currency: 'JPY', total: 50000, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } });
    const m = makeExpense('m', { currency: 'JPY', total: 30000, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } });
    const cash = tripCash([kitty], [put('a', 'alex', 30000, 30000), put('b', 'ben', 30000, 30000), put('c', 'chris', 40000, 42000)], [d, m]);
    render(
      <MemoryRouter>
        <TripSummary
          trip={trip} user={chris} expenses={[d, m]} settlements={[]} cash={cash}
          itemsByExpense={{
            d: [makeItem('di', 'd', { amount: 50000, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben', 'chris'] })],
            m: [makeItem('mi', 'm', { amount: 30000, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben'] })],
          }}
        />
      </MemoryRouter>,
    );
    const settle = within(screen.getByRole('region', { name: 'Settle up' }));
    expect(settle.getByText('Alex → You')).toBeInTheDocument();
    expect(settle.getByText('Ben → You')).toBeInTheDocument();
    expect(settle.getAllByText('A$83.00')).toHaveLength(2);
    const people = within(screen.getByRole('region', { name: 'Per person' }));
    expect(people.queryByRole('listitem', { name: /kitty/i })).not.toBeInTheDocument();
    expect(people.getByRole('listitem', { name: 'You' })).toHaveTextContent('Put in the kitty A$420.00, back ¥8,000');
    expect(screen.getByRole('region', { name: 'Kitty' })).toHaveTextContent('Hand back the ¥20,000 left: Alex ¥6,000, Ben ¥6,000, you ¥8,000.');
  });

  it('says who keeps the kitty’s leftover, and what it cost them', () => {
    const kitty: WalletDoc = { id: 'kitty_JPY', kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never, keptBy: 'chris' };
    const put = (id: string, fromUid: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
      id, walletId: 'kitty_JPY', byUid: 'alex', fromUid, date: '2027-05-09', foreignAmount, homeAmount, createdAt: null as never,
    });
    const d = makeExpense('d', { currency: 'JPY', total: 80000, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } });
    const cash = tripCash([kitty], [put('a', 'alex', 30000, 30000), put('b', 'ben', 30000, 30000), put('c', 'chris', 40000, 42000)], [d]);
    render(
      <MemoryRouter>
        <TripSummary trip={trip} user={chris} expenses={[d]} settlements={[]} cash={cash}
          itemsByExpense={{ d: [makeItem('di', 'd', { amount: 80000, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: 'Kitty' })).toHaveTextContent('You keep the ¥20,000 left, at what it cost: A$204.00.');
  });

  it('says when the kitty paid out more than was put in, and who covered it', () => {
    const kitty: WalletDoc = { id: 'kitty_JPY', kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
    const e = makeExpense('o', { currency: 'JPY', total: 1500, payerUid: 'ben', paidWith: { kind: 'wallet', walletId: 'kitty_JPY' } });
    const cash = tripCash([kitty], [
      { id: 't', walletId: 'kitty_JPY', byUid: 'alex', fromUid: 'alex', date: '2027-05-09', foreignAmount: 1000, homeAmount: 1000, createdAt: null as never },
    ], [e]);
    render(
      <MemoryRouter>
        <TripSummary trip={trip} user={chris} expenses={[e]} settlements={[]} cash={cash}
          itemsByExpense={{ o: [makeItem('oi', 'o', { amount: 1500, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: 'Kitty' })).toHaveTextContent('The JPY kitty paid out ¥500 more than was put in; whoever handed that cash over is credited for it.');
  });

  it('exports the trip as two CSV files', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsv.mock.calls.map((c) => c[0])).toEqual(['japan-expenses.csv', 'japan-cash.csv']);
    expect(downloadCsv.mock.calls[0][1]).toContain('Hotel tax');
  });

  it('says when there is nothing to settle yet', () => {
    renderSummary({ expenses: [], items: {} });
    expect(screen.getByText('No expenses yet, so nothing to settle.')).toBeInTheDocument();
  });

  describe('paying back in cash (example D)', () => {
    const w = (ownerUid: string): WalletDoc => ({ id: `${ownerUid}_JPY`, kind: 'personal', ownerUid, currency: 'JPY', createdByUid: ownerUid, createdAt: null as never });
    const up = (id: string, walletId: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
      id, walletId, byUid: 'alex', date: '2027-05-09', foreignAmount, homeAmount, createdAt: null as never,
    });
    const ups = [up('a1', 'alex_JPY', 50000, 50000), up('a2', 'alex_JPY', 50000, 53000), up('c1', 'chris_JPY', 20000, 20400)];
    const dinner = makeExpense('dinner', { currency: 'JPY', total: 60000, payerUid: 'alex', tripDay: '2027-05-12', paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });
    const items = { dinner: [makeItem('d', 'dinner', { amount: 60000, payerUid: 'alex', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] };
    const renderD = (handovers: HandoverDoc[] = []) => render(
      <MemoryRouter>
        <TripSummary trip={trip} user={chris} expenses={[dinner]} itemsByExpense={items} settlements={[]}
          cash={tripCash([w('alex'), w('chris')], ups, [dinner], handovers)} />
      </MemoryRouter>,
    );

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2027, 4, 20, 9));
    });
    afterEach(() => vi.useRealTimers());

    it('offers to pay back in cash, showing what it covers, and records the hand-over', async () => {
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderD();
      const row = within(screen.getByRole('region', { name: 'Settle up' })).getByRole('listitem', { name: 'You → Alex' });
      await u.click(within(row).getByRole('button', { name: 'Pay in cash' }));
      const amount = screen.getByLabelText('Cash to hand over (JPY)');
      await u.clear(amount);
      await u.type(amount, '20000');
      expect(screen.getByText('≈ A$204.00 of the A$206.00 owed')).toBeInTheDocument();
      await u.click(screen.getByRole('button', { name: 'Hand over' }));
      await waitFor(() => expect(handOverCash).toHaveBeenCalledWith({
        tripId: 'japan', uid: 'chris', fromUid: 'chris', toUid: 'alex', currency: 'JPY',
        foreignAmount: 20000, date: '2027-05-20', receiverHasWallet: true,
      }));
    });

    it('suggests the cash that covers the debt, up to the cash left', async () => {
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderD();
      const row = within(screen.getByRole('region', { name: 'Settle up' })).getByRole('listitem', { name: 'You → Alex' });
      await u.click(within(row).getByRole('button', { name: 'Pay in cash' }));
      expect(screen.getByLabelText('Cash to hand over (JPY)')).toHaveValue('20000');
    });

    it('shows a hand-over as paid, leaving A$2.00 to settle, and can undo it', async () => {
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderD([{ id: 'h1', fromUid: 'chris', toUid: 'alex', currency: 'JPY', foreignAmount: 20000, date: '2027-05-20', byUid: 'chris', createdAt: null as never }]);
      const settle = within(screen.getByRole('region', { name: 'Settle up' }));
      expect(settle.getByRole('listitem', { name: 'You → Alex' })).toHaveTextContent('A$2.00');
      expect(settle.getByText('You → Alex ¥20,000 in cash (≈ A$204.00)')).toBeInTheDocument();
      await u.click(settle.getByRole('button', { name: 'Undo cash hand-over' }));
      await waitFor(() => expect(undoHandover).toHaveBeenCalledWith('japan', 'h1'));
    });

    it('still settles up on a closed trip, but offers no cash hand-over', () => {
      render(
        <MemoryRouter>
          <TripSummary trip={{ ...trip, tripClosedAt: { toDate: () => new Date() } as never }} user={chris} expenses={[dinner]}
            itemsByExpense={items} settlements={[]} cash={tripCash([w('alex'), w('chris')], ups, [dinner])} />
        </MemoryRouter>,
      );
      const row = within(screen.getByRole('region', { name: 'Settle up' })).getByRole('listitem', { name: 'You → Alex' });
      expect(within(row).getByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
    });

    it('offers no cash option to someone without foreign cash', () => {
      renderD();
      const row = within(screen.getByRole('region', { name: 'Settle up' })).getByRole('listitem', { name: 'Ben → Alex' });
      expect(within(row).queryByRole('button', { name: 'Pay in cash' })).not.toBeInTheDocument();
    });
  });
});
