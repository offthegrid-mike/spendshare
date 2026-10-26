import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatMoney } from '../../lib/money';
import type { CategoryDoc } from '../../types/models';

const { updateDoc, setDoc, doc, DELETE_FIELD } = vi.hoisted(() => ({
  updateDoc: vi.fn().mockResolvedValue(undefined),
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((..._args: unknown[]) => ({ id: (_args[1] as string | undefined) ?? 'new-id' })),
  DELETE_FIELD: Symbol('deleteField'),
}));

vi.mock('firebase/firestore', () => ({
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  doc: (...args: unknown[]) => doc(...args),
  deleteField: () => DELETE_FIELD,
}));

vi.mock('../../hooks/useGroup', () => ({
  useGroup: () => ({ group: { id: 'g1', currency: 'AUD' }, loading: false }),
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

  describe('budgets', () => {
    const budgeted: CategoryDoc[] = [
      { id: 'cat1', name: 'Groceries', order: 0, archived: false, monthlyBudget: 40000 },
      { id: 'cat2', name: 'Dining', order: 1, archived: false },
    ];

    beforeEach(() => {
      useCategories.mockReturnValue({ all: budgeted, active: budgeted, loading: false });
    });

    it('shows a category’s budget under its name, and none for one without', () => {
      render(<CategoryManager />);
      // The amount is its own (monospace) element, so read the line around it.
      const amount = screen.getByText(formatMoney(40000, 'AUD'));
      expect(amount.parentElement).toHaveTextContent(`Budget ${formatMoney(40000, 'AUD')} a month`);
      expect(screen.getAllByText(/a month$/)).toHaveLength(1);
    });

    it('opens the amount field filled with the current budget, and empty without one', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Groceries' }));
      expect(screen.getByRole('textbox', { name: 'Monthly budget for Groceries' })).toHaveValue('400.00');
      await u.click(screen.getByRole('button', { name: /^cancel$/i }));

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      expect(screen.getByRole('textbox', { name: 'Monthly budget for Dining' })).toHaveValue('');
    });

    it('saves a new budget as whole cents', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.type(screen.getByRole('textbox', { name: 'Monthly budget for Dining' }), '$1,250.5');
      await u.click(screen.getByRole('button', { name: /^save$/i }));

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith({ id: 'cat2' }, { monthlyBudget: 125050 });
      // Back to the row, no longer editing.
      expect(screen.queryByRole('textbox', { name: /monthly budget/i })).not.toBeInTheDocument();
    });

    it('saves with Enter and cancels with Escape', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.type(screen.getByRole('textbox', { name: 'Monthly budget for Dining' }), '90{Escape}');
      expect(updateDoc).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox', { name: /monthly budget/i })).not.toBeInTheDocument();

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.type(screen.getByRole('textbox', { name: 'Monthly budget for Dining' }), '90{Enter}');
      expect(updateDoc).toHaveBeenCalledWith({ id: 'cat2' }, { monthlyBudget: 9000 });
    });

    it('removes the budget when the field is cleared and saved', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Groceries' }));
      await u.clear(screen.getByRole('textbox', { name: 'Monthly budget for Groceries' }));
      await u.click(screen.getByRole('button', { name: /^save$/i }));

      expect(updateDoc).toHaveBeenCalledWith({ id: 'cat1' }, { monthlyBudget: DELETE_FIELD });
    });

    it('removes the budget with the Remove button, offered only where there is one', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      expect(screen.queryByRole('button', { name: /remove budget/i })).not.toBeInTheDocument();
      await u.click(screen.getByRole('button', { name: /^cancel$/i }));

      await u.click(screen.getByRole('button', { name: 'Budget for Groceries' }));
      await u.click(screen.getByRole('button', { name: 'Remove budget for Groceries' }));
      expect(updateDoc).toHaveBeenCalledWith({ id: 'cat1' }, { monthlyBudget: DELETE_FIELD });
    });

    it('writes nothing when a blank field is saved on a category with no budget', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.click(screen.getByRole('button', { name: /^save$/i }));

      expect(updateDoc).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox', { name: /monthly budget/i })).not.toBeInTheDocument();
    });

    it('rejects an amount that is not a positive figure, and stays in the field', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.type(screen.getByRole('textbox', { name: 'Monthly budget for Dining' }), '12.345');
      await u.click(screen.getByRole('button', { name: /^save$/i }));

      expect(screen.getByText(/enter an amount like 400 or 400\.50/i)).toBeInTheDocument();
      expect(updateDoc).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: 'Monthly budget for Dining' })).toBeInTheDocument();
    });

    it('keeps the field open and says so when the save fails', async () => {
      updateDoc.mockRejectedValueOnce(new Error('offline'));
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      await u.type(screen.getByRole('textbox', { name: 'Monthly budget for Dining' }), '90');
      await u.click(screen.getByRole('button', { name: /^save$/i }));

      expect(await screen.findByText('Failed to save budget.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Monthly budget for Dining' })).toBeInTheDocument();
    });

    it('does not fire a second save when Enter is pressed again before the first resolves', async () => {
      let resolveUpdate!: () => void;
      updateDoc.mockReturnValue(new Promise<void>((resolve) => { resolveUpdate = resolve; }));
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));
      const input = screen.getByRole('textbox', { name: 'Monthly budget for Dining' });
      await u.type(input, '90');
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(updateDoc).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveUpdate();
        await Promise.resolve();
      });
    });

    it('leaves an archived category with no budget control or label', async () => {
      useCategories.mockReturnValue({
        all: [...budgeted, { id: 'cat3', name: 'Old', order: 2, archived: true, monthlyBudget: 5000 }],
        active: budgeted,
        loading: false,
      });
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getByRole('button', { name: 'Archived (1)' }));
      expect(screen.getByText('Old')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Budget for Old' })).not.toBeInTheDocument();
      expect(screen.queryByText(formatMoney(5000, 'AUD'))).not.toBeInTheDocument();
    });

    it('switches between renaming and setting a budget, one at a time', async () => {
      const u = userEvent.setup();
      render(<CategoryManager />);

      await u.click(screen.getAllByRole('button', { name: /rename/i })[0]);
      expect(screen.getByDisplayValue('Groceries')).toBeInTheDocument();
      await u.click(screen.getByRole('button', { name: 'Budget for Dining' }));

      expect(screen.queryByDisplayValue('Groceries')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Monthly budget for Dining' })).toBeInTheDocument();
    });
  });
});
