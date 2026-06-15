import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomSheet from './BottomSheet';

function renderSheet(open = true, onClose = vi.fn()) {
  return { onClose, ...render(
    <BottomSheet open={open} onClose={onClose} title="Add Expense">
      <p>Sheet content</p>
    </BottomSheet>
  )};
}

describe('BottomSheet', () => {
  it('renders title and children when open', () => {
    renderSheet(true);
    expect(screen.getByText('Add Expense')).toBeTruthy();
    expect(screen.getByText('Sheet content')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderSheet(false);
    expect(screen.queryByText('Sheet content')).toBeNull();
    expect(screen.queryByText('Add Expense')).toBeNull();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { onClose } = renderSheet(true, vi.fn());
    const backdrop = document.querySelector('[data-testid="sheet-backdrop"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a drag handle', () => {
    renderSheet(true);
    expect(document.querySelector('[data-testid="sheet-handle"]')).toBeTruthy();
  });
});
