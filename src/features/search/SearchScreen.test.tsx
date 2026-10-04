import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{pathname + search}</span>;
}

function renderScreen(path = '/search') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/search" element={<SearchScreen group={mockGroup} />} />
        <Route path="/expense/:id/edit" element={<ExpenseRoute />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

function ExpenseRoute() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Back to search</button>;
}

describe('SearchScreen', () => {
  beforeEach(() => {
    mockUseAllExpenses.mockReturnValue({ expenses, itemsByExpense, loading: false, error: null });
  });

  it('starts from the ?q= query handed over by the desktop search bar', () => {
    renderScreen('/search?q=wool');
    expect(screen.getByRole('searchbox')).toHaveValue('wool');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e1/edit');
  });

  it('prompts for a query before anything is typed', () => {
    renderScreen();
    expect(screen.getByText('Search every item your group has bought')).toBeTruthy();
  });

  it('filters expenses by shop name as you type', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'wool');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/expense/e1/edit');
    expect(links[0].textContent).toContain('Woolworths');
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

  it('restores the query and scroll position after returning from an expense', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 });
    const user = userEvent.setup();

    renderScreen();
    await user.type(screen.getByRole('searchbox'), 'wool');
    await user.click(screen.getByRole('link'));
    await user.click(screen.getByRole('button', { name: 'Back to search' }));

    expect(screen.getByRole('searchbox')).toHaveValue('wool');
    expect(scrollTo).toHaveBeenLastCalledWith(0, 240);
    scrollTo.mockRestore();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('does not restore focus to the search field after returning from an expense', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const user = userEvent.setup();

    renderScreen();
    await user.type(screen.getByRole('searchbox'), 'wool');
    await user.click(screen.getByRole('link'));
    await user.click(screen.getByRole('button', { name: 'Back to search' }));

    expect(screen.getByRole('searchbox')).not.toHaveFocus();
    scrollTo.mockRestore();
  });

  it('shows a no-results message', async () => {
    renderScreen();
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText("No items match 'zzzz'.")).toBeTruthy();
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
    expect(screen.getByText('Search every item your group has bought')).toBeTruthy();
    expect(screen.queryByText(/no items match/i)).toBeNull();
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

  // The query is deliberately kept out of the URL: it churned the address bar on
  // every keystroke and seeded browser autocomplete with ?q= URLs.
  it('keeps the query out of the URL while typing', () => {
    renderScreen();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'wool' } });

    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e1/edit');
    expect(screen.getByTestId('location').textContent).toBe('/search');
  });

  it('keeps the query out of the URL when an IME composition commits', () => {
    renderScreen();
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '街' } });
    fireEvent.compositionEnd(input, { target: { value: '街' } });

    expect(screen.getByRole('link').getAttribute('href')).toBe('/expense/e2/edit');
    expect(screen.getByTestId('location').textContent).toBe('/search');
  });

  it('shows an error message when the fetch failed', () => {
    mockUseAllExpenses.mockReturnValue({
      expenses: [], itemsByExpense: {}, loading: false, error: 'Could not load expenses. Please try again.',
    });
    renderScreen();
    expect(screen.getByText(/could not load expenses/i)).toBeTruthy();
  });
});
