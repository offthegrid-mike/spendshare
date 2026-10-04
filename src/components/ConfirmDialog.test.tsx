import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const base = { open: true, title: 'T', message: 'M', onConfirm: () => {}, onCancel: () => {} };

describe('ConfirmDialog', () => {
  it('styles the confirm button as destructive by default', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-negative');
  });

  it('styles a non-destructive confirm as the primary action', () => {
    render(<ConfirmDialog {...base} confirmLabel="Mark paid" tone="primary" />);
    const btn = screen.getByRole('button', { name: 'Mark paid' });
    expect(btn.className).toContain('btn-primary');
    expect(btn.className).not.toContain('bg-negative');
  });
});
