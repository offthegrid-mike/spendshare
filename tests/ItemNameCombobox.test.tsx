import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import ItemNameCombobox from '../src/features/expenses/ItemNameCombobox';
import type { SuggestionEntry } from '../src/types/models';

const suggestions: SuggestionEntry[] = [
  { name: 'Chicken Breast', categoryId: 'cat1', category: 'Groceries', count: 10 },
  { name: 'Chili Sauce',    categoryId: 'cat1', category: 'Groceries', count:  5 },
  { name: 'Zucchini',       categoryId: 'cat1', category: 'Groceries', count:  4 },
  { name: 'Cheese',         categoryId: 'cat1', category: 'Groceries', count:  3 },
  { name: 'Chocolate',      categoryId: 'cat2', category: 'Snacks',    count:  2 },
  { name: 'Chips',          categoryId: 'cat2', category: 'Snacks',    count:  1 },
];

// Stateful wrapper so userEvent.type() triggers controlled re-renders.
function Wrapper({
  initialValue = '',
  sugs = suggestions,
  onChangeSpy = vi.fn(),
}: {
  initialValue?: string;
  sugs?: SuggestionEntry[];
  onChangeSpy?: ReturnType<typeof vi.fn>;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <ItemNameCombobox
      value={val}
      suggestions={sugs}
      onChange={(name, s) => { setVal(name); onChangeSpy(name, s); }}
    />
  );
}

describe('ItemNameCombobox', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Visibility ────────────────────────────────────────────────────────────

  it('renders an input with no listbox when value is empty', () => {
    render(<Wrapper />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows a listbox with matching options when user types', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'chi');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // "chi" matches: Chicken Breast, Chili Sauce, Zucchini — NOT Cheese/Chocolate
    expect(screen.getByRole('option', { name: /Chicken Breast/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Chili Sauce/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Zucchini/i })).toBeInTheDocument();
  });

  it('hides the listbox when no suggestion matches', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows at most 5 suggestions even when more match', async () => {
    // All 6 suggestions contain 'c' — only 5 should appear
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'c');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
  });

  // ── Matching ──────────────────────────────────────────────────────────────

  it('matches case-insensitively', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'CHICKEN');
    expect(screen.getByRole('option', { name: /Chicken Breast/i })).toBeInTheDocument();
  });

  it('matches diacritics insensitively: "cafe" matches "Café"', async () => {
    const cafeEntry: SuggestionEntry = { name: 'Café', categoryId: 'cat3', category: 'Dining', count: 1 };
    const u = userEvent.setup();
    render(<Wrapper sugs={[cafeEntry]} />);
    await u.type(screen.getByRole('combobox'), 'cafe');
    expect(screen.getByRole('option', { name: /Caf/i })).toBeInTheDocument();
  });

  it('matches CJK substring', async () => {
    const tofu: SuggestionEntry = { name: '冷奴豆腐', categoryId: 'cat4', category: 'Japanese', count: 1 };
    const u = userEvent.setup();
    render(<Wrapper sugs={[tofu]} />);
    await u.type(screen.getByRole('combobox'), '豆腐');
    expect(screen.getByRole('option', { name: /冷奴豆腐/ })).toBeInTheDocument();
  });

  // ── Selection ─────────────────────────────────────────────────────────────

  it('calls onChange with name and suggestion entry when an option is clicked', async () => {
    const spy = vi.fn();
    const u = userEvent.setup();
    render(<Wrapper onChangeSpy={spy} />);
    await u.type(screen.getByRole('combobox'), 'chi');
    await u.click(screen.getByRole('option', { name: /Chicken Breast/i }));
    expect(spy).toHaveBeenCalledWith(
      'Chicken Breast',
      expect.objectContaining({ name: 'Chicken Breast', categoryId: 'cat1' }),
    );
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────

  it('highlights first option on ArrowDown from input', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'chi');
    await u.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('selects highlighted option on Enter', async () => {
    const spy = vi.fn();
    const u = userEvent.setup();
    render(<Wrapper onChangeSpy={spy} />);
    await u.type(screen.getByRole('combobox'), 'chi');
    await u.keyboard('{ArrowDown}{Enter}');
    expect(spy).toHaveBeenCalledWith(
      'Chicken Breast',
      expect.objectContaining({ categoryId: 'cat1' }),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown on Escape without calling onChange with a suggestion', async () => {
    const spy = vi.fn();
    const u = userEvent.setup();
    render(<Wrapper onChangeSpy={spy} />);
    await u.type(screen.getByRole('combobox'), 'chi');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // spy was called only for keystrokes (no suggestion), never with a SuggestionEntry arg
    const callsWithSuggestion = spy.mock.calls.filter(([, s]) => s !== undefined);
    expect(callsWithSuggestion).toHaveLength(0);
  });

  // ── Click-outside ─────────────────────────────────────────────────────────

  it('closes the dropdown when clicking outside', async () => {
    const u = userEvent.setup();
    render(
      <div>
        <Wrapper />
        <button>outside</button>
      </div>,
    );
    await u.type(screen.getByRole('combobox'), 'chi');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // ── ARIA ──────────────────────────────────────────────────────────────────

  it('sets aria-expanded true when dropdown is open and false when closed', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await u.type(input, 'chi');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await u.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates aria-activedescendant when navigating with arrow keys', async () => {
    const u = userEvent.setup();
    render(<Wrapper />);
    await u.type(screen.getByRole('combobox'), 'chi');
    const input = screen.getByRole('combobox');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await u.keyboard('{ArrowDown}');
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const activeOption = document.getElementById(activeId!);
    expect(activeOption).toHaveAttribute('aria-selected', 'true');
  });

  // ── RTL ───────────────────────────────────────────────────────────────────

  it('renders input and list items with dir="auto" for RTL support', async () => {
    const arabicEntry: SuggestionEntry = { name: 'خبز', categoryId: 'cat5', category: 'Groceries', count: 1 };
    const u = userEvent.setup();
    render(<Wrapper sugs={[arabicEntry]} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('dir', 'auto');
    await u.type(screen.getByRole('combobox'), 'خ');
    const option = screen.getByRole('option');
    expect(option).toHaveAttribute('dir', 'auto');
  });
});
