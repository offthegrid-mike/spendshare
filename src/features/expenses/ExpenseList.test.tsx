import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpenseList from './ExpenseList';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc, SettlementDoc } from '../../types/models';

const { commit, openAddSheet, desktop, data } = vi.hoisted(() => ({
  commit: vi.fn().mockResolvedValue(undefined),
  openAddSheet: vi.fn(),
  desktop: { value: false },
  data: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    settlements: [] as SettlementDoc[],
    loading: false,
  },
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({ delete: vi.fn(), commit }),
  doc: vi.fn(),
  collection: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/settle', () => ({ markSettlementPaid: vi.fn(), undoSettlement: vi.fn() }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({ selectedMonth: '2026-10', openAddSheet }),
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
  data.expenses = [woolies, bunnings, thai];
  data.itemsByExpense = items;
  data.settlements = [];
  data.loading = false;
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
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/expense/new');
  });

  it('groups expenses by day with the day net total', () => {
    renderList();
    const sat = screen.getByText('Sat 3 Oct').parentElement!;
    expect(sat).toHaveTextContent('51.43');
    const fri = screen.getByText('Fri 2 Oct').parentElement!;
    expect(fri).toHaveTextContent('40.00');
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

  it('deletes the selected expense from the detail pane after confirming', async () => {
    renderList();
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Woolworths');
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    });
    expect(commit).toHaveBeenCalled();
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
});
