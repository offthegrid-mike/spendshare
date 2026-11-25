import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TripExpenseList from './TripExpenseList';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben']);
const ramen = makeExpense('e1', {
  day: '2027-05-12', shopName: 'Ichiran', payerUid: 'ben', currency: 'JPY', total: 15000,
  paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
});
const taxi = makeExpense('e2', {
  day: '2027-05-10', shopName: '', payerUid: 'alex', currency: 'AUD', total: 2500,
  paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' },
});
const items = { e2: [makeItem('i1', 'e2', { name: 'Airport taxi' })] };

function renderList(expenses = [ramen, taxi]) {
  return render(
    <MemoryRouter>
      <TripExpenseList trip={trip} expenses={expenses} itemsByExpense={items} viewerUid="alex" />
    </MemoryRouter>,
  );
}

describe('TripExpenseList', () => {
  it('lists expenses under the day of the trip, newest day first', () => {
    renderList();
    const days = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(days).toEqual(['Day 3 · Wed 12 May', 'Day 1 · Mon 10 May']);
  });

  it('shows each expense in its own currency, with the home value marked as estimated until charged', () => {
    renderList();
    const row = screen.getByRole('link', { name: /Ichiran/ });
    expect(row).toHaveAttribute('href', '/travel/japan/expense/e1');
    expect(within(row).getByText('Ben paid')).toBeInTheDocument();
    expect(within(row).getByText('¥15,000')).toBeInTheDocument();
    expect(within(row).getByText('≈ A$151.52')).toBeInTheDocument();
    expect(within(row).getByText('Estimated')).toBeInTheDocument();
  });

  it('names an expense with no place after its first item, and shows a home-currency amount once', () => {
    renderList();
    const row = screen.getByRole('link', { name: /Airport taxi/ });
    expect(within(row).getByText('You paid')).toBeInTheDocument();
    expect(within(row).getByText('A$25.00')).toBeInTheDocument();
    expect(within(row).queryByText(/≈/)).not.toBeInTheDocument();
  });

  it('totals the trip so far in the home currency, saying when part of it is estimated', () => {
    renderList();
    expect(screen.getByText('Spent so far')).toBeInTheDocument();
    expect(screen.getByText('≈ A$176.52')).toBeInTheDocument();
  });

  it('has a way to add an expense, and says when there are none yet', () => {
    renderList([]);
    expect(screen.getByText('No expenses yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/travel/japan/expense/new');
  });

  it('marks a cash payment and shows its value at the wallet’s rate, or that it can’t be valued yet', () => {
    const dinner = makeExpense('e3', { day: '2027-05-12', shopName: 'Dinner', payerUid: 'alex', currency: 'JPY', total: 60000, paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });
    const lunch = makeExpense('e4', { day: '2027-05-12', shopName: 'Lunch', payerUid: 'ben', currency: 'JPY', total: 2000, paidWith: { kind: 'wallet', walletId: 'ben_JPY' } });
    render(
      <MemoryRouter>
        <TripExpenseList trip={trip} expenses={[dinner, lunch]} itemsByExpense={{}} viewerUid="alex" cashValues={{ e3: 61800, e4: null }} />
      </MemoryRouter>,
    );
    const row = screen.getByRole('link', { name: /Dinner/ });
    expect(within(row).getByText('Cash')).toBeInTheDocument();
    expect(within(row).getByText('≈ A$618.00')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Lunch/ })).getByText('Not valued yet')).toBeInTheDocument();
  });
});
