import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SearchScreen from './SearchScreen';

const mockUseAllExpenses = vi.fn();
vi.mock('../../hooks/useAllExpenses', () => ({
  useAllExpenses: () => mockUseAllExpenses(),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockGroup = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: { u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null } },
  memberUids: ['u1'], createdAt: null,
} as any;

const expenses = [
  {
    id: 'e1', shopName: 'Woolworths', groupId: 'g1', month: '2026-06', payerUid: 'u1',
    total: 5000, itemCount: 2, createdByUid: 'u1',
    date: { toMillis: () => 2000, toDate: () => new Date('2026-06-15T00:00:00Z') },
    createdAt: null, updatedAt: null,
  },
  {
    id: 'e2', shopName: '街市', groupId: 'g1', month: '2025-11', payerUid: 'u1',
    total: 3000, itemCount: 1, createdByUid: 'u1',
    date: { toMillis: () => 1000, toDate: () => new Date('2025-11-02T00:00:00Z') },
    createdAt: null, updatedAt: null,
  },
  {
    id: 'e3', shopName: 'Bunnings', groupId: 'g1', month: '2026-05', payerUid: 'u1',
    total: 8000, giftCardAmount: 2000, itemCount: 1, createdByUid: 'u1',
    date: { toMillis: () => 500, toDate: () => new Date('2026-05-01T00:00:00Z') },
    createdAt: null, updatedAt: null,
  },
] as any;

const itemsByExpense = {
  e1: [{ id: 'i1', expenseId: 'e1', name: 'Full cream milk', amount: 400 }],
  e2: [{ id: 'i2', expenseId: 'e2', name: '白菜', amount: 300 }],
  e3: [{ id: 'i3', expenseId: 'e3', name: 'Potting mix', amount: 8000 }],
} as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchScreen group={mockGroup} />
    </MemoryRouter>,
  );
}

describe('SearchScreen', () => {
  beforeEach(() => {
    mockUseAllExpenses.mockReturnValue({ expenses, itemsByExpense, loading: false, error: null });
  });

  it('prompts for a query before anything is typed', () => {
    renderScreen();
    expect(screen.getByText(/search by shop or item name/i)).toBeTruthy();
  });

  it('filters expenses by shop name as you type', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'wool');
    expect(screen.getByText(/Woolworths|wool/i)).toBeTruthy();
    expect(screen.queryByText('街市')).toBeNull();
  });

  it('matches a shop name from the middle of the string', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'worth');
    expect(screen.getByRole('link')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e1/edit');
  });

  it('finds an expense from another month by item name, including Chinese', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), '白');
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/expense/e2/edit');
    expect(link.textContent).toContain('白菜');
  });

  it('links each result to its edit page', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'wool');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e1/edit');
  });

  it('shows a no-results message', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText(/no results for/i)).toBeTruthy();
  });

  it('shows skeletons while loading', () => {
    mockUseAllExpenses.mockReturnValue({ expenses: [], itemsByExpense: {}, loading: true, error: null });
    renderScreen();
    expect(document.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('shows the gift-card treatment on a result, matching the expense list', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'bunnings');
    const link = screen.getByRole('link');
    // Original total struck through, net-to-split shown, and the badge naming
    // the gift-card amount — the same figures ExpenseList renders.
    expect(link.textContent).toContain('A$80.00');
    expect(link.textContent).toContain('A$60.00');
    expect(link.textContent).toContain('A$20.00');
    expect(within(link).getByText(/A\$80\.00/).className).toContain('line-through');
  });

  // Cangjie/Pinyin IMEs emit intermediate keystrokes ("一口廿" for 街) as change
  // events before the character is chosen. Searching on those is noise, and
  // re-rendering the input from router state mid-composition destroys the IME
  // buffer so nothing can be typed at all.
  it('does not search while an IME composition is in progress', () => {
    renderScreen();
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '一口廿' } });

    // The keystrokes stay visible in the field...
    expect(input.value).toBe('一口廿');
    // ...but no search ran: the prompt is still showing, not a no-results message.
    expect(screen.getByText(/search by shop or item name/i)).toBeTruthy();
    expect(screen.queryByText(/no results for/i)).toBeNull();
  });

  it('searches once the IME composition completes', () => {
    renderScreen();
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '一口廿' } });
    fireEvent.change(input, { target: { value: '街' } });
    fireEvent.compositionEnd(input, { target: { value: '街' } });

    expect(input.value).toBe('街');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e2/edit');
  });

  it('keeps searching normally for input typed without an IME', () => {
    renderScreen();
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'wool' } });

    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e1/edit');
  });

  it('shows an error message when the fetch failed', () => {
    mockUseAllExpenses.mockReturnValue({
      expenses: [], itemsByExpense: {}, loading: false, error: 'Could not load expenses. Please try again.',
    });
    renderScreen();
    expect(screen.getByText(/could not load expenses/i)).toBeTruthy();
  });
});
