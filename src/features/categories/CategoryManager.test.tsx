import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CategoryDoc } from '../../types/models';

const { updateDoc, setDoc, doc } = vi.hoisted(() => ({
  updateDoc: vi.fn().mockResolvedValue(undefined),
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((..._args: unknown[]) => ({ id: (_args[1] as string | undefined) ?? 'new-id' })),
}));

vi.mock('firebase/firestore', () => ({
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  doc: (...args: unknown[]) => doc(...args),
}));

vi.mock('../../lib/converters', () => ({
  categoriesCol: vi.fn(() => ({})),
}));

const { useCategories } = vi.hoisted(() => ({ useCategories: vi.fn() }));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: (...args: unknown[]) => useCategories(...args),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({ selectedGroupId: 'g1' }),
}));

import CategoryManager from './CategoryManager';

const categories: CategoryDoc[] = [
  { id: 'cat1', name: 'Groceries', order: 0, archived: false },
  { id: 'cat2', name: 'Dining', order: 1, archived: false },
];

describe('CategoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCategories.mockReturnValue({ all: categories, active: categories, loading: false });
  });

  it('disables the Save button and shows a loading indicator while renaming, then exits edit mode once it resolves', async () => {
    let resolveUpdate!: () => void;
    updateDoc.mockReturnValue(new Promise<void>((resolve) => { resolveUpdate = resolve; }));

    const u = userEvent.setup();
    render(<CategoryManager />);

    await u.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    await u.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();

    await act(async () => {
      resolveUpdate();
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: /saving|^save$/i })).not.toBeInTheDocument();
  });

  it('disables the Archive button and shows a loading indicator while archiving, then re-enables once it resolves', async () => {
    let resolveUpdate!: () => void;
    updateDoc.mockReturnValue(new Promise<void>((resolve) => { resolveUpdate = resolve; }));

    const u = userEvent.setup();
    render(<CategoryManager />);

    await u.click(screen.getAllByRole('button', { name: /^archive$/i })[0]);

    expect(await screen.findByRole('button', { name: /archiving/i })).toBeDisabled();

    await act(async () => {
      resolveUpdate();
      await Promise.resolve();
    });

    // The mocked useCategories snapshot doesn't reflect the write, so the
    // label stays "Archive" here — only the pending/disabled state is under test.
    expect(screen.getAllByRole('button', { name: /^archive$/i })[0]).not.toBeDisabled();
  });

  it('does not let another row switch into edit mode while a rename save is pending', async () => {
    let resolveUpdate!: () => void;
    updateDoc.mockReturnValue(new Promise<void>((resolve) => { resolveUpdate = resolve; }));

    const u = userEvent.setup();
    render(<CategoryManager />);

    // Start renaming cat1 ("Groceries") and save it (pending).
    await u.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    await u.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();

    // Attempt to start renaming cat2 ("Dining") while cat1's save is still in flight.
    const otherRenameButton = screen.getByRole('button', { name: /rename/i });
    await u.click(otherRenameButton);

    // The edit view must still be showing cat1 — switching rows mid-save must be blocked.
    expect(screen.getByDisplayValue('Groceries')).toBeInTheDocument();

    await act(async () => {
      resolveUpdate();
      await Promise.resolve();
    });
  });

  it('does not fire a second save when Enter is pressed again before the first save resolves', async () => {
    let resolveUpdate!: () => void;
    updateDoc.mockReturnValue(new Promise<void>((resolve) => { resolveUpdate = resolve; }));

    const u = userEvent.setup();
    render(<CategoryManager />);

    await u.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    const input = screen.getByDisplayValue('Groceries');

    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateDoc).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate();
      await Promise.resolve();
    });
  });

  it('keeps archived categories collapsed until the archived control is opened', async () => {
    useCategories.mockReturnValue({
      all: [
        ...categories,
        { id: 'cat3', name: 'Archived category', order: 2, archived: true },
      ],
      active: categories,
      loading: false,
    });

    const u = userEvent.setup();
    render(<CategoryManager />);

    expect(screen.getByRole('button', { name: 'Archived (1)' })).toBeInTheDocument();
    expect(screen.queryByText('Archived category')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Archived (1)' }));

    expect(screen.getByText('Archived category')).toBeInTheDocument();
  });
});
