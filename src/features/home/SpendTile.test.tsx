import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SpendTile from './SpendTile';
import { formatMoney } from '../../lib/money';
import { makeGroup, makeItem } from '../../test/fixtures';
import { paths } from '../../lib/paths';
import type { GroupDoc, ItemDoc, SettlementDoc } from '../../types/models';

const data = vi.hoisted(() => ({
  expenses: { itemsByExpense: {} as Record<string, unknown[]>, loading: false, itemsLoading: false },
  settlements: { settlements: [] as unknown[], loading: false },
  categories: { all: [] as unknown[], active: [] as unknown[], loading: false },
}));
vi.mock('../../hooks/useMonthExpenses', () => ({ useMonthExpenses: () => data.expenses }));
vi.mock('../../hooks/useSettlements', () => ({ useSettlements: () => data.settlements }));
vi.mock('../../hooks/useCategories', () => ({ useCategories: () => data.categories }));

const household = makeGroup('g1', 'The Smiths');

// Mike paid 245.42 shared and a 15.99 personal item, Priya 68.83 shared:
// A$330.24 spent in the month, Priya owes Mike A$88.29.
const october: Record<string, ItemDoc[]> = {
  e1: [makeItem('i1', 'e1', { amount: 24542, payerUid: 'mike' }), makeItem('i3', 'e1', { amount: 1599, payerUid: 'mike', shared: false })],
  e2: [makeItem('i2', 'e2', { amount: 6883, payerUid: 'priya' })],
};

function renderTile(props: { groups?: GroupDoc[]; group?: GroupDoc | null; viewerUid?: string } = {}) {
  const { groups = [household], group = household, viewerUid = 'mike' } = props;
  return render(
    <MemoryRouter>
      <SpendTile groups={groups} group={group} viewerUid={viewerUid} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9));
  data.expenses = { itemsByExpense: october, loading: false, itemsLoading: false };
  data.settlements = { settlements: [], loading: false };
  data.categories = { all: [], active: [], loading: false };
});

afterEach(() => vi.useRealTimers());

describe('SpendTile', () => {
  it('shows the household, month, what was spent and the balance', () => {
    renderTile();
    expect(screen.getByText(/The Smiths/)).toHaveTextContent('The Smiths · October');
    expect(screen.getByText(formatMoney(33024, 'AUD'))).toBeInTheDocument();
    expect(screen.getByText('Priya owes you')).toBeInTheDocument();
    expect(screen.getByText(formatMoney(8829, 'AUD'))).toHaveClass('text-accent-ink');
  });

  it('colours what you owe as negative', () => {
    renderTile({ viewerUid: 'priya' });
    expect(screen.getByText('You owe Mike')).toBeInTheDocument();
    expect(screen.getByText(formatMoney(8829, 'AUD'))).toHaveClass('text-negative');
  });

  it('counts a settlement already paid', () => {
    const paid: SettlementDoc = { id: 's1', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 8829, paid: true };
    data.settlements = { settlements: [paid], loading: false };
    renderTile();
    expect(screen.getByText('All settled for October')).toBeInTheDocument();
  });

  it('says there is nothing to settle in a month without expenses', () => {
    data.expenses = { itemsByExpense: {}, loading: false, itemsLoading: false };
    renderTile();
    expect(screen.getByText('Nothing to settle')).toBeInTheDocument();
    expect(screen.getByText(formatMoney(0, 'AUD'))).toBeInTheDocument();
  });

  it.each([
    ['expenses are loading', () => (data.expenses.loading = true)],
    ['items are loading', () => (data.expenses.itemsLoading = true)],
    ['settlements are loading', () => (data.settlements.loading = true)],
  ])('shows a placeholder, not zeros, while %s', (_name, load) => {
    load();
    renderTile();
    expect(screen.getByRole('status', { name: 'Loading figures' })).toBeInTheDocument();
    expect(screen.queryByText(formatMoney(0, 'AUD'))).toBeNull();
    expect(screen.queryByText('Nothing to settle')).toBeNull();
    expect(screen.queryByText('Priya owes you')).toBeNull();
  });

  it('shows the placeholder while the selected household is still loading', () => {
    renderTile({ group: null });
    expect(screen.getByRole('status', { name: 'Loading figures' })).toBeInTheDocument();
  });

  it('links the heading row to SpendShare', () => {
    renderTile();
    expect(screen.getByRole('link', { name: 'SpendShare' })).toHaveAttribute('href', paths.spend);
  });

  it('has an Add expense link for desktop, beside the heading link rather than inside it', () => {
    renderTile();
    const add = screen.getByRole('link', { name: 'Add expense' });
    expect(add).toHaveAttribute('href', paths.newExpense);
    expect(add).toHaveClass('hidden', 'lg:inline-flex');
    expect(screen.getByRole('link', { name: 'SpendShare' })).not.toContainElement(add);
  });

  describe('budget line', () => {
    // The month's A$330.24 is all Groceries (cat-groceries), 19 of October's 31 days in.
    const budget = (monthlyBudget?: number, extra: Record<string, unknown> = {}) => {
      const all = [{ id: 'cat-groceries', name: 'Groceries', order: 0, archived: false, monthlyBudget, ...extra }];
      data.categories = { all, active: all, loading: false };
    };

    it('shows nothing when no category has a budget', () => {
      budget(undefined);
      renderTile();
      expect(screen.queryByText(/budget/i)).toBeNull();
      expect(screen.queryByText(/days left/)).toBeNull();
    });

    it('says budgets are on track while none is at 80%', () => {
      budget(100000);
      renderTile();
      expect(screen.getByText('Budgets on track')).toBeInTheDocument();
      expect(screen.getByText('12 days left')).toBeInTheDocument();
    });

    it('names the budget at 80% or more, amber, with the days left', () => {
      budget(38000); // 33024 of 38000 = 87%
      renderTile();
      expect(screen.getByText('Groceries 87% used')).toHaveClass('text-warning');
      expect(screen.getByText('12 days left')).toBeInTheDocument();
    });

    it('says how far over a budget that has been passed, in red', () => {
      budget(30000);
      renderTile();
      expect(screen.getByText('Groceries over budget')).toHaveClass('text-negative');
      expect(screen.getByText(`${formatMoney(3024, 'AUD')} over`)).toHaveClass('text-negative');
    });

    it('leaves out an archived category’s budget', () => {
      budget(30000, { archived: true });
      renderTile();
      expect(screen.queryByText(/budget|used/i)).toBeNull();
    });

    it('links to the Summary, where the bars are', () => {
      budget(38000);
      renderTile();
      expect(screen.getByRole('link', { name: /Groceries 87% used/ })).toHaveAttribute('href', paths.summary);
    });

    it('does not hold the tile back while the categories load', () => {
      data.categories = { all: [], active: [], loading: true };
      renderTile();
      expect(screen.getByText('Priya owes you')).toBeInTheDocument();
      expect(screen.queryByText(/budget/i)).toBeNull();
    });
  });

  describe('with no household yet', () => {
    it('invites you to create one through SpendShare', () => {
      renderTile({ groups: [], group: null });
      expect(screen.getByRole('link', { name: /Create a household/ })).toHaveAttribute('href', paths.spend);
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Add expense' })).toBeNull();
    });
  });
});
