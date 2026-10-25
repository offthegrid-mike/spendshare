import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeExpense, makeItem } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc, SuggestionsDoc } from '../../types/models';

const { getDoc, set, commit, writeCache, history } = vi.hoisted(() => ({
  getDoc: vi.fn(),
  set: vi.fn(),
  commit: vi.fn(),
  writeCache: vi.fn(),
  history: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    loading: false,
    error: null as string | null,
    calledWith: [] as (string | null)[],
  },
}));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => getDoc(...args),
  writeBatch: () => ({ set, commit }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  suggestionsDocRef: (gid: string) => ({ path: `groups/${gid}/suggestions/index` }),
}));
vi.mock('../../hooks/useItemSuggestions', () => ({ writeCache }));
vi.mock('../../hooks/useAllExpenses', () => ({
  useAllExpenses: (gid: string | null) => {
    history.calledWith.push(gid);
    return gid === null
      ? { expenses: [], itemsByExpense: {}, loading: false, error: null }
      : history;
  },
}));

import RebuildSuggestions from './RebuildSuggestions';

const expense = makeExpense('e1', { shopName: 'Coles' });
const milk = { name: 'Milk', categoryId: 'cat-groceries', category: 'Groceries' };
const recount = {
  items: [{ ...milk, count: 1 }],
  shops: [{ name: 'Coles', count: 1 }],
};

function suggestionsSnap(doc: Pick<SuggestionsDoc, 'items' | 'shops'> | null) {
  return { exists: () => doc !== null, data: () => doc };
}

const rebuildButton = () => screen.getByRole('button', { name: 'Rebuild autocomplete' });

beforeEach(() => {
  vi.clearAllMocks();
  commit.mockResolvedValue(undefined);
  history.expenses = [expense];
  history.itemsByExpense = { e1: [makeItem('i1', 'e1', milk)] };
  history.loading = false;
  history.error = null;
  history.calledWith = [];
});

describe('RebuildSuggestions', () => {
  it('loads nothing until the button is pressed', () => {
    render(<RebuildSuggestions groupId="g1" />);
    expect(history.calledWith.every((gid) => gid === null)).toBe(true);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('says autocomplete is up to date and writes nothing when the recount matches', async () => {
    getDoc.mockResolvedValue(suggestionsSnap(recount));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Autocomplete is already up to date.')).toBeInTheDocument();
    expect(history.calledWith).toContain('g1');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('asks before replacing drifted suggestions, then writes the recount', async () => {
    getDoc.mockResolvedValue(suggestionsSnap({
      items: [{ ...milk, count: 4 }, { name: 'Bread', categoryId: 'cat-groceries', category: 'Groceries', count: 2 }],
      shops: [{ name: 'Coles', count: 3 }],
    }));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('2 item suggestions and 1 shop suggestion');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rebuild' }));

    expect(set).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { ...recount, updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(commit).toHaveBeenCalled();
    expect(writeCache).toHaveBeenCalledWith('g1', recount.items, recount.shops);
    expect(await screen.findByText('Autocomplete rebuilt.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('writes nothing when the rebuild is cancelled', async () => {
    getDoc.mockResolvedValue(suggestionsSnap(null));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('shows an error when the write fails', async () => {
    getDoc.mockResolvedValue(suggestionsSnap(null));
    commit.mockRejectedValue(new Error('offline'));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rebuild' }));

    expect(await screen.findByText('Failed to rebuild. Please try again.')).toBeInTheDocument();
    expect(writeCache).not.toHaveBeenCalled();
  });

  it('shows an error and asks nothing when the suggestions cannot be read', async () => {
    getDoc.mockRejectedValue(new Error('offline'));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Failed to rebuild. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the history error when the expenses cannot be loaded', async () => {
    getDoc.mockResolvedValue(suggestionsSnap(null));
    history.error = 'Could not load expenses. Please try again.';
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Could not load expenses. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
