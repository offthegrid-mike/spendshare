import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import ExpenseList from './ExpenseList';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc, SettlementDoc, ShopEntry, SuggestionEntry } from '../../types/models';
import { paths } from '../../lib/paths';

const { commit, batchSet, refundDocs, invalidateGroupHistory, openAddSheet, desktop, ui, data, suggestions } = vi.hoisted(() => ({
  commit: vi.fn().mockResolvedValue(undefined),
  batchSet: vi.fn(),
  refundDocs: { value: [] as unknown[] },
  invalidateGroupHistory: vi.fn(),
  openAddSheet: vi.fn(),
  desktop: { value: false },
  ui: { month: '2026-10' },
  data: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    settlements: [] as SettlementDoc[],
    loading: false,
  },
  suggestions: {
    items: [] as SuggestionEntry[],
    shops: [] as ShopEntry[],
    loaded: true,
  },
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({ delete: vi.fn(), set: batchSet, commit }),
  doc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: () => 'now',
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  getDocs: () => Promise.resolve({ empty: refundDocs.value.length === 0, docs: refundDocs.value }),
}));
vi.mock('../../lib/converters', () => ({ suggestionsDocRef: (gid: string) => ({ path: `groups/${gid}/suggestions/index` }) }));
vi.mock('../../hooks/useAllExpenses', () => ({ invalidateGroupHistory }));
vi.mock('../../hooks/useRefunds', () => ({ useRefunds: () => ({ refunds: [], loading: false, error: false }) }));
vi.mock('../../hooks/useItemSuggestions', () => ({
  useItemSuggestions: () => [suggestions.items, suggestions.shops, suggestions.loaded],
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/settle', () => ({ markSettlementPaid: vi.fn(), undoSettlement: vi.fn() }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({ selectedMonth: ui.month, openAddSheet }),
}));
vi.mock('../../hooks/useMediaQuery', () => ({ useIsDesktop: () => desktop.value }));
vi.mock('../../hooks/useMonthExpenses', () => ({
  useMonthExpenses: () => ({
    expenses: data.expenses, itemsByExpense: data.itemsByExpense, loading: data.loading, itemsLoading: false,
  }),
}));
vi.mock('../../hooks/useSettlements', () => ({
  useSettlements: () => ({ settlements: data.settlements, loading: false }),
}));

const pair = makeGroup('g1', 'Home');

// Newest first, as useMonthExpenses orders them.
const woolies = makeExpense('e1', { shopName: 'Woolworths', day: '2026-10-03', total: 3000 });
const bunnings = makeExpense('e2', { shopName: 'Bunnings', day: '2026-10-03', total: 2143, payerUid: 'priya' });
const thai = makeExpense('e3', { shopName: 'Thai Riffic', day: '2026-10-02', total: 4740, payerUid: 'priya', giftCardAmount: 740 });
const items = {
  e1: [makeItem('i1', 'e1', { name: 'Bananas', amount: 3000 })],
  e2: [makeItem('i2', 'e2', { name: 'Potting mix', amount: 2143, payerUid: 'priya', category: 'Household' })],
  e3: [makeItem('i3', 'e3', { name: 'Pad see ew', amount: 4740, payerUid: 'priya', category: 'Dining' })],
};

function renderList() {
  return render(
    <MemoryRouter>
      <input aria-label="Search items" />
      <ExpenseList group={pair} currentUserUid="mike" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  desktop.value = false;
  ui.month = '2026-10';
  data.expenses = [woolies, bunnings, thai];
  data.itemsByExpense = items;
  data.settlements = [];
  data.loading = false;
  suggestions.items = [];
  suggestions.shops = [];
  suggestions.loaded = true;
});

describe('ExpenseList', () => {
  it('shows skeletons while loading', () => {
    data.loading = true;
    renderList();
    expect(screen.getByRole('status', { name: 'Loading expenses' })).toBeInTheDocument();
    expect(screen.queryByText('Woolworths')).toBeNull();
  });

  it('opens the Add Expense sheet from the empty state on mobile', async () => {
    data.expenses = [];
    data.itemsByExpense = {};
    renderList();
    expect(screen.getByText('Nothing to settle')).toBeInTheDocument();
    expect(screen.getByText('No expenses in October yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(openAddSheet).toHaveBeenCalled();
  });

  it('links to the editor page from the empty state on desktop', () => {
    desktop.value = true;
    data.expenses = [];
    data.itemsByExpense = {};
    renderList();
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', paths.newExpense);
  });

  it('groups expenses by day with the day net total', () => {
    renderList();
    const sat = screen.getByText('Sat 3 Oct').parentElement!;
    expect(sat).toHaveTextContent('51.43');
    const fri = screen.getByText('Fri 2 Oct').parentElement!;
    expect(fri).toHaveTextContent('40.00');
  });

  it('takes a refund off its day total', () => {
    const refund = makeExpense('r1', { shopName: 'Woolworths', day: '2026-10-02', total: 1000, kind: 'refund', refundOf: 'e1' });
    data.expenses = [woolies, bunnings, refund, thai];
    data.itemsByExpense = { ...items, r1: [makeItem('i9', 'r1', { name: 'Bananas', amount: 1000, refund: true })] };
    renderList();
    const fri = screen.getByText('Fri 2 Oct').parentElement!;
    expect(fri).toHaveTextContent('30.00');
  });

  it('shows a day that is all refunds as a negative total', () => {
    const refund = makeExpense('r1', { shopName: 'Woolworths', day: '2026-10-01', total: 1000, kind: 'refund', refundOf: 'e1' });
    data.expenses = [woolies, refund];
    data.itemsByExpense = { e1: items.e1, r1: [makeItem('i9', 'r1', { name: 'Bananas', amount: 1000, refund: true })] };
    renderList();
    const thu = screen.getByText('Thu 1 Oct').parentElement!;
    expect(thu).toHaveTextContent('−10.00');
  });

  it('shows the balance hero for the month', () => {
    renderList();
    // Mike paid 30.00 shared, Priya 68.83: Mike owes half the difference.
    expect(screen.getByText('You owe Priya')).toBeInTheDocument();
    expect(screen.getByText('19.42')).toBeInTheDocument();
  });

  it("lists the month's paid settlements at the top", () => {
    data.settlements = [{
      id: 's1', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 4120, paid: true,
      paidAt: { toDate: () => new Date(2026, 9, 2), toMillis: () => 0 } as unknown as SettlementDoc['paidAt'],
    }];
    renderList();
    expect(screen.getByText('Settled 2 Oct: Priya paid you A$41.20')).toBeInTheDocument();
  });

  it('expands one row at a time on mobile', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: /Woolworths/ }));
    expect(screen.getByText('Bananas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Bunnings/ }));
    expect(screen.queryByText('Bananas')).toBeNull();
    expect(screen.getByText('Potting mix')).toBeInTheDocument();
  });
});

describe('ExpenseList on desktop', () => {
  beforeEach(() => {
    desktop.value = true;
  });

  const detail = () => screen.getByRole('complementary', { name: 'Expense detail' });

  it('selects the first expense and shows it in the detail pane', () => {
    renderList();
    expect(screen.getByRole('option', { name: /Woolworths/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(detail()).getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
    expect(screen.getAllByRole('listbox')).toHaveLength(2);
  });

  it('selects an expense on click', async () => {
    renderList();
    await userEvent.click(screen.getByRole('option', { name: /Thai Riffic/ }));
    expect(screen.getByRole('option', { name: /Thai Riffic/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(detail()).getByRole('heading', { name: 'Thai Riffic' })).toBeInTheDocument();
  });

  it('moves the selection across days with the arrow keys', async () => {
    renderList();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(within(detail()).getByRole('heading', { name: 'Thai Riffic' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(detail()).getByRole('heading', { name: 'Thai Riffic' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowUp}');
    expect(within(detail()).getByRole('heading', { name: 'Bunnings' })).toBeInTheDocument();
  });

  it('ignores the arrow keys while typing in a field', async () => {
    renderList();
    await userEvent.click(screen.getByRole('textbox', { name: 'Search items' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(within(detail()).getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
  });

  it('falls back to the first expense when the selected one disappears', async () => {
    const { rerender } = renderList();
    await userEvent.click(screen.getByRole('option', { name: /Thai Riffic/ }));
    data.expenses = [woolies, bunnings];
    rerender(
      <MemoryRouter>
        <input aria-label="Search items" />
        <ExpenseList group={pair} currentUserUid="mike" />
      </MemoryRouter>,
    );
    expect(within(detail()).getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
  });

  async function deleteSelected() {
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }));
    await act(async () => {
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    });
  }

  it('deletes the selected expense from the detail pane after confirming', async () => {
    renderList();
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Woolworths');
    await act(async () => {
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    });
    expect(commit).toHaveBeenCalled();
  });

  it("lowers the deleted expense's item and shop suggestion counts in the same batch", async () => {
    suggestions.items = [
      { name: 'Bananas', categoryId: 'cat-groceries', category: 'Groceries', count: 3 },
      { name: 'Milk', categoryId: 'cat-groceries', category: 'Groceries', count: 1 },
    ];
    suggestions.shops = [{ name: 'Woolworths', count: 1 }, { name: 'Coles', count: 2 }];
    renderList();
    await deleteSelected();

    const items = [{ name: 'Bananas', categoryId: 'cat-groceries', category: 'Groceries', count: 2 },
      { name: 'Milk', categoryId: 'cat-groceries', category: 'Groceries', count: 1 }];
    const shops = [{ name: 'Coles', count: 2 }];
    expect(batchSet).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { items, shops, updatedAt: 'now' },
    );
    expect(batchSet.mock.invocationCallOrder[0]).toBeLessThan(commit.mock.invocationCallOrder[0]);
  });

  it("forgets the group's shared history when the delete is committed", async () => {
    renderList();
    await deleteSelected();
    expect(invalidateGroupHistory).toHaveBeenCalledWith('g1');
    expect(invalidateGroupHistory.mock.invocationCallOrder[0]).toBeGreaterThan(commit.mock.invocationCallOrder[0]);
  });

  it('will not delete an expense that has refunds', async () => {
    refundDocs.value = [{ id: 'r1' }];
    try {
      renderList();
      await deleteSelected();
      expect(commit).not.toHaveBeenCalled();
      expect(await screen.findByText('This expense has refunds. Delete them first.')).toBeInTheDocument();
    } finally {
      refundDocs.value = [];
    }
  });

  it('leaves the suggestions alone when deleting a refund', async () => {
    suggestions.items = [{ name: 'Bananas', categoryId: 'cat-groceries', category: 'Groceries', count: 3 }];
    suggestions.shops = [{ name: 'Woolworths', count: 1 }];
    const refund = makeExpense('r1', { shopName: 'Woolworths', day: '2026-10-04', total: 500, kind: 'refund', refundOf: 'e1' });
    data.expenses = [refund, woolies];
    data.itemsByExpense = { ...items, r1: [makeItem('i9', 'r1', { name: 'Bananas', amount: 500, refund: true })] };
    renderList();
    await deleteSelected();
    expect(commit).toHaveBeenCalled();
    expect(batchSet).not.toHaveBeenCalled();
  });

  it('leaves the suggestions alone when they have not loaded yet', async () => {
    suggestions.loaded = false;
    renderList();
    await deleteSelected();
    expect(commit).toHaveBeenCalled();
    expect(batchSet).not.toHaveBeenCalled();
  });

  it('ignores arrow keys another control already handled, such as the gear menu', async () => {
    render(
      <MemoryRouter>
        <button type="button" onKeyDown={(e) => e.preventDefault()}>Menu item</button>
        <ExpenseList group={pair} currentUserUid="mike" />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: 'Menu item' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(detail()).getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
  });

  it('ignores arrow keys while the delete dialog is open', async () => {
    renderList();
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(within(detail()).getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
  });

  it('moves keyboard focus with the selection when the list has focus', async () => {
    renderList();
    screen.getByRole('option', { name: /Woolworths/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Bunnings/ })).toHaveFocus();
    expect(screen.getByRole('option', { name: /Bunnings/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects a focused option with Enter or Space', async () => {
    renderList();
    screen.getByRole('option', { name: /Thai Riffic/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(within(detail()).getByRole('heading', { name: 'Thai Riffic' })).toBeInTheDocument();
    screen.getByRole('option', { name: /Bunnings/ }).focus();
    await userEvent.keyboard(' ');
    expect(within(detail()).getByRole('heading', { name: 'Bunnings' })).toBeInTheDocument();
  });

  function renderRoutedList() {
    return render(
      <MemoryRouter initialEntries={['/spend']}>
        <Routes>
          <Route
            path="/spend"
            element={
              <>
                <input aria-label="Search items" />
                <ExpenseList group={pair} currentUserUid="mike" />
              </>
            }
          />
          <Route path={paths.editExpense(':id')} element={<EditorProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('opens the selected expense in the editor with E', async () => {
    renderRoutedList();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('e');
    expect(screen.getByTestId('editing')).toHaveTextContent('e2');
  });

  it('accepts a capital E too', async () => {
    renderRoutedList();
    await userEvent.keyboard('E');
    expect(screen.getByTestId('editing')).toHaveTextContent('e1');
  });

  it('ignores E while typing in a field', async () => {
    renderRoutedList();
    await userEvent.click(screen.getByRole('textbox', { name: 'Search items' }));
    await userEvent.keyboard('e');
    expect(screen.queryByTestId('editing')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search items' })).toHaveValue('e');
  });

  it('ignores E with a modifier or while the delete dialog is open', async () => {
    renderRoutedList();
    await userEvent.keyboard('{Meta>}e{/Meta}');
    expect(screen.queryByTestId('editing')).toBeNull();
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }));
    await userEvent.keyboard('e');
    expect(screen.queryByTestId('editing')).toBeNull();
  });

  it('advertises the E shortcut on the Edit link', () => {
    renderList();
    expect(within(detail()).getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-keyshortcuts', 'E');
  });
});

function EditorProbe() {
  const { id } = useParams();
  return <p data-testid="editing">{id}</p>;
}

describe('ExpenseList category filter', () => {
  const filterGroup = () => screen.getByRole('group', { name: 'Filter by category' });
  const chip = (name: string) => within(filterGroup()).getByRole('button', { name });
  const summary = () => screen.getByTestId('category-filter-summary');

  // Woolworths also bought something Household, on the same day as Bunnings.
  function mixedBasket() {
    data.expenses = [{ ...woolies, total: 3500, itemCount: 2 }, bunnings, thai];
    data.itemsByExpense = {
      ...items,
      e1: [...items.e1, makeItem('i9', 'e1', { name: 'Sponges', amount: 500, category: 'Household' })],
    };
  }

  it('offers All and each category in the month, biggest spend first', () => {
    renderList();
    expect(within(filterGroup()).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['All', 'Dining', 'Groceries', 'Household']);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('category-filter-summary')).toBeNull();
  });

  it('has no filter when the month has a single category', () => {
    data.expenses = [woolies];
    data.itemsByExpense = { e1: items.e1 };
    renderList();
    expect(screen.queryByRole('group', { name: 'Filter by category' })).toBeNull();
  });

  it('has no filter for a month with no expenses', () => {
    data.expenses = [];
    data.itemsByExpense = {};
    renderList();
    expect(screen.queryByRole('group', { name: 'Filter by category' })).toBeNull();
  });

  it('keeps only the expenses with an item in the chosen category', async () => {
    renderList();
    await userEvent.click(chip('Household'));
    expect(chip('Household')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Bunnings/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Woolworths/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Thai Riffic/ })).toBeNull();
    expect(screen.queryByText('Fri 2 Oct')).toBeNull();
  });

  it('sums up the filtered category and how many expenses it spans', async () => {
    renderList();
    await userEvent.click(chip('Household'));
    expect(summary()).toHaveTextContent('Household · A$21.43 · 1 expense');
  });

  it('counts a category’s items only, and pluralises the expenses', async () => {
    mixedBasket();
    renderList();
    await userEvent.click(chip('Household'));
    expect(summary()).toHaveTextContent('Household · A$26.43 · 2 expenses');
  });

  it('shows each day’s total for the category alone, but each row at its full amount', async () => {
    mixedBasket();
    renderList();
    await userEvent.click(chip('Household'));
    expect(screen.getByText('Sat 3 Oct').parentElement).toHaveTextContent('26.43');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toHaveTextContent('35.00');
  });

  it('keeps a day’s total as paid when the filter covers everything that day', async () => {
    // Thai Riffic used a 7.40 gift card: its row, and so its day, read 40.00 even though its items add to 47.40.
    renderList();
    expect(screen.getByText('Fri 2 Oct').parentElement).toHaveTextContent('40.00');
    await userEvent.click(chip('Dining'));
    expect(screen.getByText('Fri 2 Oct').parentElement).toHaveTextContent('40.00');
    expect(summary()).toHaveTextContent('Dining · A$47.40 · 1 expense');
  });

  it('labels each row with the category being filtered on', async () => {
    mixedBasket();
    renderList();
    expect(screen.getByRole('button', { name: /Woolworths/ })).toHaveTextContent('Groceries · 2 items');
    await userEvent.click(chip('Household'));
    expect(screen.getByRole('button', { name: /Woolworths/ })).toHaveTextContent('Household · 2 items');
  });

  it('leaves the balance alone while filtering', async () => {
    renderList();
    await userEvent.click(chip('Household'));
    expect(screen.getByText('You owe Priya')).toBeInTheDocument();
    expect(screen.getByText('19.42')).toBeInTheDocument();
  });

  it('shows everything again on All', async () => {
    renderList();
    await userEvent.click(chip('Household'));
    await userEvent.click(chip('All'));
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
    expect(screen.getByText('Sat 3 Oct').parentElement).toHaveTextContent('51.43');
    expect(screen.queryByTestId('category-filter-summary')).toBeNull();
  });

  it('drops the filter when another month is chosen', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    ui.month = '2026-11';
    rerender(
      <MemoryRouter>
        <input aria-label="Search items" />
        <ExpenseList group={pair} currentUserUid="mike" />
      </MemoryRouter>,
    );
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
  });

  function rerenderList(rerender: (ui: React.ReactElement) => void, group = pair) {
    rerender(
      <MemoryRouter>
        <input aria-label="Search items" />
        <ExpenseList group={group} currentUserUid="mike" />
      </MemoryRouter>,
    );
  }

  it('drops the filter when the month falls to one category and the chips go', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    data.expenses = [bunnings];
    data.itemsByExpense = { e2: items.e2 };
    rerenderList(rerender);
    expect(screen.queryByRole('group', { name: 'Filter by category' })).toBeNull();
    expect(screen.queryByTestId('category-filter-summary')).toBeNull();
  });

  it('does not bring a dropped filter back when its month is chosen again', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    ui.month = '2026-11';
    rerenderList(rerender);
    ui.month = '2026-10';
    rerenderList(rerender);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
  });

  it('does not bring a dropped filter back when its group is chosen again', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    rerenderList(rerender, makeGroup('g2', 'Beach house'));
    rerenderList(rerender);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not bring a dropped filter back when its category returns to the month', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    data.expenses = [woolies, thai];
    data.itemsByExpense = { e1: items.e1, e3: items.e3 };
    rerenderList(rerender);
    data.expenses = [woolies, bunnings, thai];
    data.itemsByExpense = items;
    rerenderList(rerender);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
  });

  it('drops the filter when another group is chosen, even one with the same category', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    rerender(
      <MemoryRouter>
        <input aria-label="Search items" />
        <ExpenseList group={makeGroup('g2', 'Beach house')} currentUserUid="mike" />
      </MemoryRouter>,
    );
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
  });

  it('drops the filter when its category is no longer in the month', async () => {
    const { rerender } = renderList();
    await userEvent.click(chip('Household'));
    data.expenses = [woolies, thai];
    data.itemsByExpense = { e1: items.e1, e3: items.e3 };
    rerender(
      <MemoryRouter>
        <input aria-label="Search items" />
        <ExpenseList group={pair} currentUserUid="mike" />
      </MemoryRouter>,
    );
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Woolworths/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thai Riffic/ })).toBeInTheDocument();
  });
});

describe('ExpenseList category filter on desktop', () => {
  beforeEach(() => {
    desktop.value = true;
  });

  const chip = (name: string) =>
    within(screen.getByRole('group', { name: 'Filter by category' })).getByRole('button', { name });
  const detail = () => screen.getByRole('complementary', { name: 'Expense detail' });

  it('lists only the matches and selects the first of them', async () => {
    renderList();
    await userEvent.click(chip('Household'));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Bunnings/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(detail()).getByRole('heading', { name: 'Bunnings' })).toBeInTheDocument();
  });

  it('shows the filtered category on the detail pane, as on the selected row', async () => {
    data.expenses = [{ ...woolies, total: 3500, itemCount: 2 }, bunnings, thai];
    data.itemsByExpense = {
      ...items,
      e1: [...items.e1, makeItem('i9', 'e1', { name: 'Sponges', amount: 500, category: 'Household' })],
    };
    renderList();
    await userEvent.click(chip('Household'));
    await userEvent.click(screen.getByRole('option', { name: /Woolworths/ }));
    expect(detail().querySelector('.lucide-house')).not.toBeNull();
    expect(detail().querySelector('.lucide-shopping-basket')).toBeNull();
  });

  it('keeps the arrow keys within the filtered expenses', async () => {
    data.expenses = [woolies, bunnings, { ...thai, shopName: 'Mitre 10' }];
    data.itemsByExpense = { ...items, e3: [makeItem('i4', 'e3', { category: 'Household', amount: 900 })] };
    renderList();
    await userEvent.click(chip('Household'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(within(detail()).getByRole('heading', { name: 'Mitre 10' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Woolworths/ })).toBeNull();
  });
});
