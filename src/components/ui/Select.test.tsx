import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

const OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'food', label: 'Food' },
  { value: 'fun', label: 'Fun' },
];

function Harness({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('food');
  return (
    <>
      <label htmlFor="cat">Category</label>
      <Select
        id="cat"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        options={OPTIONS}
      />
    </>
  );
}

describe('Select', () => {
  it('is a button, never a native select, showing the chosen label', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('select')).toBeNull();
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('Food');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens a listbox with every option and marks the selected one', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['No category', 'Food', 'Fun']);
    expect(screen.getByRole('option', { name: 'Food' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reports a clicked option, closes, and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: 'Fun' }));
    expect(onChange).toHaveBeenCalledWith('fun');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveTextContent('Fun');
    expect(trigger).toHaveFocus();
  });

  it('chooses with the keyboard: arrows move, Enter picks, Escape cancels', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('fun');

    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it('jumps to an option by typing its first letters', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.keyboard('fu{Enter}');
    expect(onChange).toHaveBeenCalledWith('fun');
  });

  it('closes on an outside click without changing anything', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a placeholder when the value matches no option', () => {
    render(<Select value="zzz" onChange={() => {}} options={OPTIONS} placeholder="Pick one" aria-label="X" />);
    expect(screen.getByRole('combobox', { name: 'X' })).toHaveTextContent('Pick one');
  });

  it('does not open when disabled', async () => {
    render(<Select value="food" onChange={() => {}} options={OPTIONS} disabled aria-label="X" />);
    await userEvent.click(screen.getByRole('combobox', { name: 'X' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
