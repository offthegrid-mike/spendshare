import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripSummary from './TripSummary';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc, SettlementDoc } from '../../types/models';

const { markSettlementPaid, undoSettlement } = vi.hoisted(() => ({
  markSettlementPaid: vi.fn(), undoSettlement: vi.fn(),
}));
vi.mock('../../lib/settle', () => ({ markSettlementPaid, undoSettlement }));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const chris = { uid: 'chris' } as User;
// Worked example C: Ben pays ¥15,000 by card, shared by Ben and Chris, estimated at 1 A$ = ¥99.
const tax = makeExpense('tax', {
  shopName: 'Hotel tax', payerUid: 'ben', currency: 'JPY', total: 15000,
  paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
});
const taxItems = [makeItem('i1', 'tax', { amount: 15000, payerUid: 'ben', shared: true, sharedWith: ['ben', 'chris'], category: 'Accommodation' })];

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
    expect(ben).toHaveTextContent('Paid A$151.52 · Share A$75.76');
    expect(people.getByRole('listitem', { name: 'You' })).toHaveTextContent('You owe A$75.76');
    expect(people.getByRole('listitem', { name: 'Alex' })).toHaveTextContent('Settled');
  });

  it('totals the spending by category and by the currency paid in', () => {
    const taxi = makeExpense('taxi', { payerUid: 'alex', currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    renderSummary({
      expenses: [tax, taxi],
      items: { tax: taxItems, taxi: [makeItem('t', 'taxi', { amount: 2500, payerUid: 'alex', category: 'Transport' })] },
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

  it('says when there is nothing to settle yet', () => {
    renderSummary({ expenses: [], items: {} });
    expect(screen.getByText('No expenses yet, so nothing to settle.')).toBeInTheDocument();
  });
});
