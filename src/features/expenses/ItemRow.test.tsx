import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import ItemRow from './ItemRow';
import type { FormValues } from './expenseForm';

const cats = [{ id: 'c1', name: 'Fruit', order: 0, archived: false }] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function Harness({
  shared = true,
  remark = '',
  expanded = false,
  onToggle = vi.fn(),
  onRemove = vi.fn(),
}: { shared?: boolean; remark?: string; expanded?: boolean; onToggle?: () => void; onRemove?: () => void }) {
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
      summary={{ name: 'Cherry', categoryId: 'c1', amount: '3.00', shared, remark }}
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

  it('marks an unshared item as Personal', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByText('Personal')).toBeNull();
    unmount();
    render(<Harness shared={false} />);
    expect(screen.getByRole('button', { name: /cherry/i })).toHaveTextContent('Personal');
  });

  it('shows the remark in the collapsed row', () => {
    render(<Harness remark="on sale" />);
    expect(screen.getByRole('button', { name: /cherry/i })).toHaveTextContent('on sale');
  });

  it('calls onToggle when the summary row is clicked', () => {
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /cherry/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reveals the remark and remove controls when expanded', () => {
    render(<Harness expanded />);
    expect(screen.getByPlaceholderText(/on sale, for party/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove item/i })).toBeTruthy();
  });

  it('arms on the first click without calling onRemove', () => {
    const onRemove = vi.fn();
    render(<Harness expanded onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(screen.getByRole('button', { name: /click again to remove/i })).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('calls onRemove on the second click while armed', () => {
    const onRemove = vi.fn();
    render(<Harness expanded onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    fireEvent.click(screen.getByRole('button', { name: /click again to remove/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('resets the armed label back on blur', () => {
    const onRemove = vi.fn();
    render(<Harness expanded onRemove={onRemove} />);
    const btn = screen.getByRole('button', { name: /remove item/i });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /click again to remove/i })).toBeTruthy();
    fireEvent.blur(btn);
    expect(screen.getByRole('button', { name: /remove item/i })).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('resets the armed label back after the timeout', () => {
    vi.useFakeTimers();
    try {
      const onRemove = vi.fn();
      render(<Harness expanded onRemove={onRemove} />);
      fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
      expect(screen.getByRole('button', { name: /click again to remove/i })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole('button', { name: /remove item/i })).toBeTruthy();
      expect(onRemove).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

const twoCats = [
  { id: 'c1', name: 'Fruit', order: 0, archived: false },
  { id: 'c2', name: 'Bakery', order: 1, archived: false },
] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function WatchedHarness({ categoryUnconfirmed }: { categoryUnconfirmed: boolean }) {
  const { control, register, setValue } = useForm<FormValues>({
    defaultValues: {
      date: '', shopName: '', payerUid: 'u1', giftCardAmount: '', applyDiscount: false,
      items: [{ name: 'Firewood', categoryId: 'c1', amount: '18.00', shared: true, remark: '', categoryUnconfirmed }],
    },
  });
  const items = useWatch({ control, name: 'items' });
  return (
    <ItemRow
      index={0} control={control} register={register} setValue={setValue}
      cats={twoCats} suggestions={[]} summary={items[0]} currency="AUD"
      expanded onToggle={vi.fn()} onRemove={vi.fn()}
    />
  );
}

describe('ItemRow category check', () => {
  it('marks an unconfirmed category and names the category it was given', () => {
    render(<WatchedHarness categoryUnconfirmed />);
    expect(screen.getByText('Check category: Fruit')).toBeInTheDocument();
  });

  it('shows no marker for a confirmed category', () => {
    render(<WatchedHarness categoryUnconfirmed={false} />);
    expect(screen.queryByText(/check category/i)).toBeNull();
  });

  it('clears the marker once a category is chosen', () => {
    render(<WatchedHarness categoryUnconfirmed />);
    fireEvent.change(screen.getByDisplayValue('Fruit'), { target: { value: 'c2' } });
    expect(screen.queryByText(/check category/i)).toBeNull();
  });

  it('clears the marker when the select loses focus, so the guess can be accepted as-is', () => {
    render(<WatchedHarness categoryUnconfirmed />);
    fireEvent.blur(screen.getByDisplayValue('Fruit'));
    expect(screen.queryByText(/check category/i)).toBeNull();
  });
});
