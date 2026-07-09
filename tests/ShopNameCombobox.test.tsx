import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShopNameCombobox from '../src/features/expenses/ShopNameCombobox';
import type { ShopEntry } from '../src/types/models';

const shops: ShopEntry[] = [
  { name: 'Woolworths', count: 5 },
  { name: 'Coles', count: 3 },
  { name: 'ALDI', count: 1 },
];

describe('ShopNameCombobox', () => {
  it('renders an input with the provided value', () => {
    render(<ShopNameCombobox value="Woolworths" suggestions={shops} onChange={vi.fn()} />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Woolworths');
  });

  it('shows suggestions filtered by input value', async () => {
    const u = userEvent.setup();
    render(<ShopNameCombobox value="" suggestions={shops} onChange={vi.fn()} />);
    await u.type(screen.getByRole('combobox'), 'col');
    expect(screen.getByText(/Coles/i)).toBeInTheDocument();
    expect(screen.queryByText('Woolworths')).not.toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<ShopNameCombobox value="" suggestions={shops} onChange={onChange} />);
    await u.type(screen.getByRole('combobox'), 'W');
    expect(onChange).toHaveBeenCalledWith('W');
  });

  it('calls onChange with suggestion name on click', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<ShopNameCombobox value="W" suggestions={shops} onChange={onChange} />);
    await u.click(screen.getByRole('combobox'));
    const option = screen.getByText(/Woolworths/i);
    await u.click(option);
    expect(onChange).toHaveBeenCalledWith('Woolworths');
  });

  it('navigates suggestions with ArrowDown and selects with Enter', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<ShopNameCombobox value="o" suggestions={shops} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await u.click(input);
    await u.keyboard('{ArrowDown}');
    await u.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(expect.any(String));
  });

  it('does not open the dropdown or steal focus on mount with an initial value', () => {
    render(<ShopNameCombobox value="Woolworths" suggestions={shops} onChange={vi.fn()} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).not.toHaveFocus();
  });

  it('hides dropdown when Escape is pressed', async () => {
    const u = userEvent.setup();
    render(<ShopNameCombobox value="W" suggestions={shops} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await u.click(input);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not render a listbox when suggestions list is empty', () => {
    render(<ShopNameCombobox value="xyz" suggestions={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not show category badge (no categoryId display)', () => {
    render(<ShopNameCombobox value="w" suggestions={shops} onChange={vi.fn()} />);
    // ItemNameCombobox would show a category badge; ShopNameCombobox should not
    expect(screen.queryByText(/groceries/i)).not.toBeInTheDocument();
  });
});
