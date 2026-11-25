import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripScreen from './TripScreen';

const hook = vi.hoisted(() => ({
  calls: [] as (string | null)[], error: false, retry: vi.fn(),
  expenses: [] as unknown[], itemsByExpense: {} as Record<string, unknown[]>, settlementCalls: [] as unknown[][],
  settlements: [] as unknown[],
}));
vi.mock('../../hooks/useTripWallets', () => ({
  useTripWallets: () => ({ wallets: [], topUps: [], loading: false, error: false }),
}));
vi.mock('../../hooks/useSettlements', () => ({
  useSettlements: (...args: unknown[]) => {
    hook.settlementCalls.push(args);
    return { settlements: hook.settlements, loading: false };
  },
}));
vi.mock('../../hooks/useTripExpenses', () => ({
  useTripExpenses: (id: string | null) => {
    hook.calls.push(id);
    return { expenses: hook.expenses, itemsByExpense: hook.itemsByExpense, loading: false, itemsLoading: false, error: hook.error, retry: hook.retry };
  },
}));
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';

const japan = makeTrip('japan', 'Japan', '2026-10-17', '2026-10-27', ['Mike', 'Priya', 'Sam']);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/travel/:tripId" element={<TripScreen trips={[japan]} viewerUid="mike" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // 19 October 2026
});
afterEach(() => vi.useRealTimers());

describe('TripScreen', () => {
  it('shows the trip, its dates, progress and who is going', () => {
    renderAt('/travel/japan');
    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
    expect(screen.getByText('17–27 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Day 3 of 11')).toBeInTheDocument();
    const going = within(screen.getByRole('list', { name: 'Who’s going' }));
    expect(going.getAllByRole('listitem')).toHaveLength(3);
    expect(going.getByText('Mike (you)')).toBeInTheDocument();
    expect(going.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('Home currency: AUD')).toBeInTheDocument();
  });

  it('links to the trip settings for members and invites', () => {
    renderAt('/travel/japan');
    expect(screen.getByRole('link', { name: 'Members and settings' })).toHaveAttribute('href', '/travel/japan/settings');
  });

  it('says so for a trip the user is not on, with a way back', () => {
    renderAt('/travel/nope');
    expect(screen.getByText('Trip not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All trips' })).toHaveAttribute('href', '/travel');
  });

  it('lists the trip’s expenses, with a way to add one', () => {
    renderAt('/travel/japan');
    expect(hook.calls).toContain('japan');
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/travel/japan/expense/new');
  });

  it('offers to try again when the expenses could not be loaded', async () => {
    hook.error = true;
    renderAt('/travel/japan');
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(hook.retry).toHaveBeenCalled();
    hook.error = false;
  });

  it('shows the viewer’s balance with a way to settle up', () => {
    hook.expenses = [makeExpense('e', { payerUid: 'priya', currency: 'AUD', total: 3000, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } })];
    hook.itemsByExpense = { e: [makeItem('i', 'e', { amount: 3000, payerUid: 'priya', shared: true, sharedWith: ['mike', 'priya', 'sam'] })] };
    renderAt('/travel/japan');
    const card = screen.getByRole('region', { name: 'Your balance' });
    expect(card).toHaveTextContent('You owe A$10.00');
    expect(within(card).getByRole('link', { name: 'Balances and settle-up' })).toHaveAttribute('href', '/travel/japan/summary');
    expect(hook.settlementCalls).toContainEqual(['japan', 'trip']);
    hook.expenses = [];
    hook.itemsByExpense = {};
  });

  it('shows a balance left by a paid settlement even with no expenses', () => {
    hook.settlements = [{ id: 's', month: 'trip', fromUid: 'mike', toUid: 'priya', amount: 1000, paid: true }];
    renderAt('/travel/japan');
    expect(screen.getByRole('region', { name: 'Your balance' })).toHaveTextContent('You get back A$10.00');
    hook.settlements = [];
  });

  it('links to the trip’s cash', () => {
    renderAt('/travel/japan');
    expect(screen.getByRole('link', { name: 'Cash' })).toHaveAttribute('href', '/travel/japan/cash');
  });
});
