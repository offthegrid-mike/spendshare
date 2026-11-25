import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripExpenseDetail from './TripExpenseDetail';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { ExpenseDoc } from '../../types/models';
import { useUIStore } from '../../stores/uiStore';
import { tripCash } from '../../lib/travel/cash';

const { recordCharge, deleteTripExpense } = vi.hoisted(() => ({ recordCharge: vi.fn(), deleteTripExpense: vi.fn() }));
vi.mock('./tripWrite', () => ({ recordCharge, deleteTripExpense }));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const alex = { uid: 'alex' } as User;
const estimated = makeExpense('e1', {
  day: '2027-05-12', shopName: 'Hotel', payerUid: 'ben', currency: 'JPY', total: 15000,
  paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
});
const items = [
  makeItem('i1', 'e1', { name: 'City tax', amount: 15000, shared: true, sharedWith: ['ben', 'chris'] }),
];

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderDetail(expense: ExpenseDoc = estimated) {
  return render(
    <MemoryRouter initialEntries={['/travel/japan/expense/e1']}>
      <Routes>
        <Route path="/travel/:tripId/expense/:expenseId" element={<TripExpenseDetail trip={trip} user={alex} expenses={[expense]} itemsByExpense={{ e1: items }} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  recordCharge.mockReset().mockResolvedValue(undefined);
  deleteTripExpense.mockReset().mockResolvedValue(undefined);
});

describe('TripExpenseDetail', () => {
  it('shows the expense, its estimated rate, and who shares each item', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Hotel' })).toBeInTheDocument();
    expect(screen.getByText('Ben paid · Wed 12 May 2027')).toBeInTheDocument();
    expect(screen.getAllByText('¥15,000')).toHaveLength(2); // the total and its one item
    expect(screen.getByText('≈ A$151.52 at 1 AUD = 99 JPY (estimated)')).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('City tax')).toBeInTheDocument();
    expect(within(item).getByText('Shared by Ben and Chris')).toBeInTheDocument();
  });

  it('records what the card was actually charged', async () => {
    const u = userEvent.setup();
    renderDetail();
    await u.type(screen.getByLabelText('Amount charged (AUD)'), '155.10');
    await u.click(screen.getByRole('button', { name: 'Save amount charged' }));
    await waitFor(() => expect(recordCharge).toHaveBeenCalledWith('japan', estimated, 15510, 'AUD', 'alex'));
  });

  it('refuses an amount charged that is not a positive number', async () => {
    const u = userEvent.setup();
    renderDetail();
    await u.type(screen.getByLabelText('Amount charged (AUD)'), 'abc');
    await u.click(screen.getByRole('button', { name: 'Save amount charged' }));
    expect(await screen.findByText('Enter the amount in AUD, as on your statement.')).toBeInTheDocument();
    expect(recordCharge).not.toHaveBeenCalled();
  });

  it('shows the amount charged once entered, and lets it be changed', async () => {
    const u = userEvent.setup();
    renderDetail({ ...estimated, paidWith: { kind: 'card', rate: 96.7118, rateStatus: 'actual', homeTotal: 15510 } });
    expect(screen.getByText('Charged A$155.10 (1 AUD = 96.71 JPY)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount charged (AUD)')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Amount charged (AUD)')).toHaveValue('155.10');
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Amount charged (AUD)')).not.toBeInTheDocument();
    expect(screen.getByText('Charged A$155.10 (1 AUD = 96.71 JPY)')).toBeInTheDocument();
  });

  it('asks nothing about a home-currency expense', () => {
    renderDetail({ ...estimated, currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    expect(screen.getByText('A$25.00')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount charged (AUD)')).not.toBeInTheDocument();
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });

  it('links to editing, and deletes after confirming, back to the trip', async () => {
    const u = userEvent.setup();
    renderDetail();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/travel/japan/expense/e1/edit');
    await u.click(screen.getByRole('button', { name: 'Delete' }));
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteTripExpense).toHaveBeenCalledWith('japan', 'e1', ['i1']));
    expect(screen.getByTestId('where')).toHaveTextContent('/travel/japan');
  });

  it('goes straight back to the trip on delete, and says so if the delete fails later', async () => {
    deleteTripExpense.mockRejectedValue(new Error('denied'));
    useUIStore.setState({ notice: null });
    const u = userEvent.setup();
    renderDetail();
    await u.click(screen.getByRole('button', { name: 'Delete' }));
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/travel/japan');
    await waitFor(() => expect(useUIStore.getState().notice?.message).toBe("Couldn't delete the expense. Try again."));
  });

  it('shows the day the payer chose', () => {
    renderDetail({ ...estimated, tripDay: '2027-05-11' });
    expect(screen.getByText('Ben paid · Tue 11 May 2027')).toBeInTheDocument();
  });

  it('shows a cash payment’s wallet and its value at the cash’s average rate, with nothing to enter', () => {
    const dinner = { ...estimated, payerUid: 'alex', total: 60000, paidWith: { kind: 'wallet' as const, walletId: 'alex_JPY' } };
    const cash = tripCash(
      [{ id: 'alex_JPY', kind: 'personal', ownerUid: 'alex', currency: 'JPY', createdByUid: 'alex', createdAt: null as never }],
      [
        { id: 't1', walletId: 'alex_JPY', byUid: 'alex', date: '2027-05-09', foreignAmount: 50000, homeAmount: 50000, createdAt: null as never },
        { id: 't2', walletId: 'alex_JPY', byUid: 'alex', date: '2027-05-09', foreignAmount: 50000, homeAmount: 53000, createdAt: null as never },
      ],
      [dinner],
    );
    render(
      <MemoryRouter initialEntries={['/travel/japan/expense/e1']}>
        <Routes>
          <Route path="/travel/:tripId/expense/:expenseId" element={<TripExpenseDetail trip={trip} user={alex} expenses={[dinner]} itemsByExpense={{ e1: items }} cash={cash} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Paid in cash from your JPY cash · ≈ A$618.00 at its average rate (1 AUD = 97.09 JPY)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount charged (AUD)')).not.toBeInTheDocument();
  });

  it('says so for an expense that is not on the trip', () => {
    render(
      <MemoryRouter initialEntries={['/travel/japan/expense/nope']}>
        <Routes>
          <Route path="/travel/:tripId/expense/:expenseId" element={<TripExpenseDetail trip={trip} user={alex} expenses={[]} itemsByExpense={{}} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Expense not found')).toBeInTheDocument();
  });
});
