import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickAddBar from './QuickAddBar';

const cats = [
  { id: 'c1', name: 'Fruit', order: 0, archived: false },
  { id: 'c2', name: 'Bakery', order: 1, archived: false },
] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const suggestions = [
  { name: 'Cherry', categoryId: 'c1', category: 'Fruit', count: 5 },
] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function setup(sugs: any[] = []) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const onAdd = vi.fn();
  render(<QuickAddBar cats={cats} suggestions={sugs} onAdd={onAdd} />);
  return { onAdd };
}

describe('QuickAddBar', () => {
  it('adds an item with the entered name, amount, category and shared', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '3.00' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(onAdd).toHaveBeenCalledWith({
      name: 'Cherry',
      amount: '3.00',
      categoryId: 'c1',
      shared: true,
    });
  });

  it('clears name and amount but keeps category after adding', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '3.00' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect((screen.getByPlaceholderText(/item name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/category/i) as HTMLSelectElement).value).toBe('c1');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('adds when Enter is pressed in the amount field', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '4.20' } });
    fireEvent.keyDown(screen.getByLabelText(/amount/i), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('does not add and shows a hint when the name is empty', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/enter an item name/i)).toBeTruthy();
  });

  it('does not add when the amount is missing or invalid', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/enter an amount/i)).toBeTruthy();
  });

  it('adds when Enter is pressed in the item-name field', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '4.20' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/item name/i), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({
      name: 'Milk',
      amount: '4.20',
      categoryId: '',
      shared: true,
    });
  });

  it('does not add and shows the amount hint on Enter in the name field when amount is missing', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Milk' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/item name/i), { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/enter an amount/i)).toBeTruthy();
  });

  it('returns focus to the item-name input after adding via the Add button', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/item name/i));
  });

  it('returns focus to the item-name input after adding via Enter in the amount field', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '3.00' } });
    fireEvent.keyDown(screen.getByLabelText(/amount/i), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/item name/i));
  });

  it('selects the highlighted suggestion on Enter in the name field without adding', async () => {
    const u = userEvent.setup();
    const { onAdd } = setup(suggestions);
    await u.type(screen.getByPlaceholderText(/item name/i), 'Che');
    // Dropdown is open with a matching suggestion.
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await u.keyboard('{ArrowDown}{Enter}');
    // Enter picked the suggestion instead of adding the item.
    expect(onAdd).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText(/item name/i) as HTMLInputElement).value).toBe('Cherry');
  });
});
