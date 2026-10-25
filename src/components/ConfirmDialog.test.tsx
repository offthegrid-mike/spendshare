import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const base = { open: true, title: 'T', message: 'M', onConfirm: () => {}, onCancel: () => {} };

describe('ConfirmDialog', () => {
  it('styles the confirm button as destructive by default', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-negative');
  });

  it('cancels with Esc', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores Esc when closed', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open={false} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('styles a non-destructive confirm as the primary action', () => {
    render(<ConfirmDialog {...base} confirmLabel="Mark paid" tone="primary" />);
    const btn = screen.getByRole('button', { name: 'Mark paid' });
    expect(btn.className).toContain('btn-primary');
    expect(btn.className).not.toContain('bg-negative');
  });
});
