import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import ItemRow from './ItemRow';
import type { FormValues } from './expenseForm';

const cats = [{ id: 'c1', name: 'Fruit', order: 0, archived: false }] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function Harness({
  shared = true,
  expanded = false,
  onToggle = vi.fn(),
  onRemove = vi.fn(),
}: { shared?: boolean; expanded?: boolean; onToggle?: () => void; onRemove?: () => void }) {
  const { control, register, setValue } = useForm<FormValues>({
    defaultValues: {
      date: '', shopName: '', payerUid: 'u1', giftCardAmount: '',
      items: [{ name: 'Cherry', categoryId: 'c1', amount: '3.00', shared, remark: '' }],
    },
  });
  return (
    <ItemRow
      index={0}
      control={control}
      register={register}
      setValue={setValue}
      cats={cats}
      suggestions={[]}
      summary={{ name: 'Cherry', categoryId: 'c1', amount: '3.00', shared }}
      currency="AUD"
      expanded={expanded}
      onToggle={onToggle}
      onRemove={onRemove}
    />
  );
}

describe('ItemRow', () => {
  it('shows the item name, category chip and amount when collapsed', () => {
    render(<Harness />);
    expect(screen.getByText('Cherry')).toBeTruthy();
    expect(screen.getByText('Fruit')).toBeTruthy();
    expect(screen.getByText(/3\.00/)).toBeTruthy();
  });

  it('shows a "not shared" indicator only when the item is not shared', () => {
    const { rerender } = render(<Harness shared={true} />);
    expect(screen.queryByLabelText(/not shared/i)).toBeNull();
    rerender(<Harness shared={false} />);
    expect(screen.getByLabelText(/not shared/i)).toBeTruthy();
  });

  it('calls onToggle when the summary row is clicked', () => {
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /cherry/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reveals the remark and remove controls when expanded', () => {
    const onRemove = vi.fn();
    render(<Harness expanded onRemove={onRemove} />);
    expect(screen.getByPlaceholderText(/on sale, for party/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
