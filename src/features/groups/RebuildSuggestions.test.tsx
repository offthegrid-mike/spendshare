import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeExpense, makeItem } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc, SuggestionsDoc } from '../../types/models';

const { getDocFromServer, set, commit, history } = vi.hoisted(() => ({
  getDocFromServer: vi.fn(),
  set: vi.fn(),
  commit: vi.fn(),
  history: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    loading: false,
    error: null as string | null,
    calledWith: [] as (string | null)[],
    fresh: [] as (boolean | undefined)[],
  },
}));

vi.mock('firebase/firestore', () => ({
  getDocFromServer: (...args: unknown[]) => getDocFromServer(...args),
  writeBatch: () => ({ set, commit }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  suggestionsDocRef: (gid: string) => ({ path: `groups/${gid}/suggestions/index` }),
}));
vi.mock('../../hooks/useAllExpenses', () => ({
  // Snapshots the history when it first loads, like the real one-shot fetch.
  useAllExpenses: (gid: string | null, opts?: { fresh?: boolean }) => {
    history.calledWith.push(gid);
    history.fresh.push(opts?.fresh);
    const [fetched] = useState(() => (gid === null ? null : { ...history }));
    return gid === null || fetched === null
      ? { expenses: [], itemsByExpense: {}, loading: gid !== null, error: null }
      : fetched;
  },
}));

import RebuildSuggestions from './RebuildSuggestions';

const expense = makeExpense('e1', { shopName: 'Coles' });
const milk = { name: 'Milk', categoryId: 'cat-groceries', category: 'Groceries' };
const recount = {
  items: [{ ...milk, count: 1 }],
  shops: [{ name: 'Coles', count: 1 }],
  tags: [],
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
  history.fresh = [];
});

describe('RebuildSuggestions', () => {
  it('always loads the history fresh, never from the shared copy', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(recount));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());
    await screen.findByText('Autocomplete is already up to date.');
    expect(history.fresh.every((f) => f === true)).toBe(true);
  });

  it('loads nothing until the button is pressed', () => {
    render(<RebuildSuggestions groupId="g1" />);
    expect(history.calledWith.every((gid) => gid === null)).toBe(true);
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('says autocomplete is up to date and writes nothing when the recount matches', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(recount));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Autocomplete is already up to date.')).toBeInTheDocument();
    expect(history.calledWith).toContain('g1');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('asks before replacing drifted suggestions, then writes the recount', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap({
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
    expect(await screen.findByText('Autocomplete rebuilt.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('writes nothing when the rebuild is cancelled', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(null));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('shows an error when the write fails', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(null));
    commit.mockRejectedValue(new Error('offline'));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rebuild' }));

    expect(await screen.findByText('Failed to rebuild. Please try again.')).toBeInTheDocument();
  });

  it('shows a load error and asks nothing when the suggestions cannot be read', async () => {
    getDocFromServer.mockRejectedValue(new Error('offline'));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Could not load autocomplete. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('recounts from freshly loaded history on a second run', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(recount));
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());
    expect(await screen.findByText('Autocomplete is already up to date.')).toBeInTheDocument();

    // Another expense is saved before the second run.
    const later = makeExpense('e2', { shopName: 'Aldi', day: '2026-10-04' });
    history.expenses = [later, expense];
    history.itemsByExpense = { ...history.itemsByExpense, e2: [makeItem('i2', 'e2', milk)] };
    await userEvent.click(rebuildButton());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Recounting from 2 expenses changes 1 item suggestion and 1 shop suggestion.');
  });

  it('can try again after the history fails to load', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(null));
    history.error = 'Could not load expenses. Please try again.';
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());
    expect(await screen.findByText(history.error)).toBeInTheDocument();

    history.error = null;
    await userEvent.click(rebuildButton());

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByText('Could not load expenses. Please try again.')).toBeNull();
  });

  it('shows the history error when the expenses cannot be loaded', async () => {
    getDocFromServer.mockResolvedValue(suggestionsSnap(null));
    history.error = 'Could not load expenses. Please try again.';
    render(<RebuildSuggestions groupId="g1" />);
    await userEvent.click(rebuildButton());

    expect(await screen.findByText('Could not load expenses. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
