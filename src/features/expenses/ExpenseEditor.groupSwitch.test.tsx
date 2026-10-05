import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import ExpenseEditor from './ExpenseEditor';
import { useUIStore } from '../../stores/uiStore';
import { readDraftRecord, writeDraft } from '../../hooks/useExpenseDraft';
import { makeGroup } from '../../test/fixtures';
import { createGroup } from '../../lib/createGroup';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  expensesCol: vi.fn(() => ({})),
  itemsCol: vi.fn(() => ({})),
  suggestionsDocRef: vi.fn(() => ({})),
}));
vi.mock('../../lib/createGroup', () => ({ createGroup: vi.fn(), CURRENCIES: ['AUD', 'USD', 'EUR', 'GBP'] }));

const { batchSets, fetchActiveCategories, catsState } = vi.hoisted(() => ({
  batchSets: [] as Record<string, unknown>[],
  fetchActiveCategories: vi.fn(),
  catsState: { loading: false },
}));
vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({
    set: (_ref: unknown, data: Record<string, unknown>) => { batchSets.push(data); },
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }),
  doc: vi.fn(() => ({ id: 'new-id' })),
  serverTimestamp: vi.fn(() => 'TS'),
  Timestamp: { fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }) },
}));

const homeCats = [
  { id: 'h-groc', name: 'Groceries', order: 0, archived: false },
  { id: 'h-house', name: 'Household', order: 1, archived: false },
];
const tripCats = [
  { id: 't-groc', name: 'Groceries', order: 0, archived: false },
  { id: 't-fuel', name: 'Fuel', order: 1, archived: false },
];
vi.mock('../../hooks/useCategories', () => ({
  useCategories: (gid: string) => {
    const cats = gid === 'g2' ? tripCats : homeCats;
    return { all: cats, active: cats, loading: catsState.loading };
  },
  fetchActiveCategories,
}));
vi.mock('../../hooks/useItemSuggestions', () => ({
  useItemSuggestions: () => [[], [], true],
  writeCache: vi.fn(),
}));

const home = makeGroup('g1', 'Hartley House', ['Mike', 'Priya']);
const trip = makeGroup('g2', 'Tasmania trip', ['Mike', 'Priya', 'Tomas', 'Ana']);
const user = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

const entry = {
  date: '2026-10-04', shopName: 'Coles Hobart', payerUid: 'priya',
  giftCardAmount: '', applyDiscount: false, discountPercent: '',
  items: [
    { name: 'Firewood', categoryId: 'h-house', amount: '18.00', quantity: '1', shared: true, remark: '' },
    { name: 'Snacks', categoryId: 'h-groc', amount: '12.40', quantity: '1', shared: true, remark: '' },
  ],
};

function renderEditor(props: Partial<Parameters<typeof ExpenseEditor>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ExpenseEditor group={home} groups={[home, trip]} user={user} currentUserUid="mike" {...props} />
    </MemoryRouter>,
  );
}

async function chooseGroup(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: /change group/i }));
  await userEvent.click(screen.getByRole('option', { name }));
}

beforeEach(() => {
  localStorage.clear();
  batchSets.length = 0;
  fetchActiveCategories.mockReset().mockResolvedValue(tripCats);
  catsState.loading = false;
  useUIStore.setState({ selectedGroupId: 'g1', pendingGroupId: null });
});

describe('ExpenseEditor group chip', () => {
  it('shows the group a new expense is recorded in, with Change', () => {
    renderEditor();
    expect(screen.getByText('Recording in')).toBeInTheDocument();
    expect(screen.getByText('Hartley House')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change group/i })).toBeInTheDocument();
  });

  it('has no Change when editing an existing expense', () => {
    const expense = {
      id: 'e1', groupId: 'g1', shopName: 'Coles', payerUid: 'mike', total: 100, itemCount: 0, month: '2026-10',
      date: { seconds: 1783900800, nanoseconds: 0 }, createdByUid: 'mike', createdAt: null, updatedAt: null,
    } as never;
    renderEditor({ expense, items: [] });
    expect(screen.getByText('Hartley House')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change group/i })).toBeNull();
  });

  it('has no Change while the categories are still loading', () => {
    catsState.loading = true;
    renderEditor();
    expect(screen.queryByRole('button', { name: /change group/i })).toBeNull();
  });

  it('has no Change without the group list', () => {
    renderEditor({ groups: undefined });
    expect(screen.queryByRole('button', { name: /change group/i })).toBeNull();
  });
});

describe('ExpenseEditor changing group', () => {
  it('only switches the app when the form is empty', async () => {
    renderEditor();
    await chooseGroup(/Tasmania trip/);
    expect(useUIStore.getState().selectedGroupId).toBe('g2');
    expect(fetchActiveCategories).not.toHaveBeenCalled();
    expect(readDraftRecord('g2')).toBeNull();
  });

  it('moves the entry to the new group and switches the app', async () => {
    writeDraft('g1', entry);
    renderEditor();
    await chooseGroup(/Tasmania trip/);

    await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
    expect(fetchActiveCategories).toHaveBeenCalledWith('g2');
    expect(readDraftRecord('g1')).toBeNull();
    const moved = readDraftRecord('g2');
    expect(moved?.movedFrom).toBe('Hartley House');
    expect(moved?.values.payerUid).toBe('mike');
    expect(moved?.values.items.map((i) => [i.name, i.categoryId, i.categoryUnconfirmed])).toEqual([
      ['Firewood', 't-groc', true],
      ['Snacks', 't-groc', false],
    ]);
  });

  it('does not let a pending autosave rewrite the old group draft', async () => {
    writeDraft('g1', entry);
    renderEditor();
    await userEvent.type(screen.getByLabelText('Shop name'), 'x');
    await chooseGroup(/Tasmania trip/);
    await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
    await new Promise((r) => setTimeout(r, 500));
    expect(readDraftRecord('g1')).toBeNull();
  });

  it('keeps everything in place when the group cannot be loaded', async () => {
    fetchActiveCategories.mockRejectedValue(new Error('offline'));
    writeDraft('g1', entry);
    renderEditor();
    await chooseGroup(/Tasmania trip/);

    expect(await screen.findByText("Couldn't load that group. Try again.")).toBeInTheDocument();
    expect(useUIStore.getState().selectedGroupId).toBe('g1');
    expect(readDraftRecord('g1')).not.toBeNull();
    expect(readDraftRecord('g2')).toBeNull();
  });

  it('switches once when a group is tapped twice while loading', async () => {
    let resolve: (cats: typeof tripCats) => void = () => {};
    fetchActiveCategories.mockReturnValue(new Promise((r) => { resolve = r; }));
    writeDraft('g1', entry);
    renderEditor();
    await chooseGroup(/Tasmania trip/);
    await userEvent.click(screen.getByRole('option', { name: /Tasmania trip/ }));
    resolve(tripCats);

    await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
    expect(fetchActiveCategories).toHaveBeenCalledTimes(1);
  });

  it('does not hand off when the editor unmounts while the group loads', async () => {
    let resolve: (cats: typeof tripCats) => void = () => {};
    fetchActiveCategories.mockReturnValue(new Promise((r) => { resolve = r; }));
    writeDraft('g1', entry);
    const { unmount } = renderEditor();
    await chooseGroup(/Tasmania trip/);
    await waitFor(() => expect(fetchActiveCategories).toHaveBeenCalled());
    unmount();
    await act(async () => { resolve(tripCats); });

    expect(useUIStore.getState().selectedGroupId).toBe('g1');
    expect(readDraftRecord('g1')).not.toBeNull();
    expect(readDraftRecord('g2')).toBeNull();
  });

  it('creates a group once even if Create is tapped again while the move is loading', async () => {
    vi.mocked(createGroup).mockResolvedValue('g-new');
    fetchActiveCategories.mockReturnValue(new Promise(() => {}));
    writeDraft('g1', entry);
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /change group/i }));
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    await userEvent.type(screen.getByLabelText('Group name'), 'Studio rent');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(fetchActiveCategories).toHaveBeenCalledWith('g-new'));

    const button = screen.getByRole('button', { name: 'Creating…' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(createGroup).toHaveBeenCalledTimes(1);
  });

  it('returns to the form on Escape', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /change group/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByLabelText('Shop name')).toBeVisible();
    expect(screen.getByRole('button', { name: /change group/i })).toHaveFocus();
  });

  it('returns focus to Change after Back', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /change group/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to expense' }));
    expect(screen.getByRole('button', { name: /change group/i })).toHaveFocus();
  });

  it('cannot go back to the old form after handing the entry off', async () => {
    writeDraft('g1', entry);
    renderEditor();
    await chooseGroup(/Tasmania trip/);
    await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
    expect(screen.getByRole('button', { name: 'Back to expense' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByLabelText('Shop name')).not.toBeVisible();
  });

  describe('when the target group already has an unsaved entry', () => {
    beforeEach(() => {
      writeDraft('g2', { ...entry, shopName: 'Salamanca market' });
      writeDraft('g1', entry);
    });

    it("asks before replacing the target group's unsaved entry", async () => {
      renderEditor();
      await chooseGroup(/Tasmania trip/);
      expect(
        await screen.findByText('Tasmania trip already has an unsaved entry. Replace it with this one?'),
      ).toBeInTheDocument();
      expect(fetchActiveCategories).not.toHaveBeenCalled();
      expect(useUIStore.getState().selectedGroupId).toBe('g1');
      expect(readDraftRecord('g2')?.values.shopName).toBe('Salamanca market');
    });

    it('replaces the target entry when confirmed', async () => {
      renderEditor();
      await chooseGroup(/Tasmania trip/);
      await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
      await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
      expect(readDraftRecord('g2')?.values.shopName).toBe('Coles Hobart');
      expect(readDraftRecord('g1')).toBeNull();
    });

    it('keeps the entry here when the replacing write fails', async () => {
      const realSetItem = Storage.prototype.setItem;
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === 'expense_draft_g2') throw new Error('QuotaExceededError');
        realSetItem.call(this, key, value);
      });
      try {
        renderEditor();
        await chooseGroup(/Tasmania trip/);
        await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
        await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g2'));
        expect(readDraftRecord('g1')?.values.shopName).toBe('Coles Hobart');
        expect(readDraftRecord('g2')?.values.shopName).toBe('Salamanca market');
      } finally {
        setItem.mockRestore();
      }
    });

    it('keeps both entries when replacing is cancelled', async () => {
      renderEditor();
      await chooseGroup(/Tasmania trip/);
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText(/already has an unsaved entry/)).toBeNull();
      expect(readDraftRecord('g1')?.values.shopName).toBe('Coles Hobart');
      expect(readDraftRecord('g2')?.values.shopName).toBe('Salamanca market');
      expect(useUIStore.getState().selectedGroupId).toBe('g1');
    });
  });

  it('goes back to the form without changing anything', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /change group/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to expense' }));
    expect(screen.getByLabelText('Shop name')).toBeVisible();
    expect(useUIStore.getState().selectedGroupId).toBe('g1');
  });
});

describe('ExpenseEditor after a move', () => {
  const movedEntry = {
    ...entry,
    payerUid: 'mike',
    items: [
      { ...entry.items[0], categoryId: 't-groc', categoryUnconfirmed: true },
      { ...entry.items[1], categoryId: 't-groc', categoryUnconfirmed: false },
    ],
  };

  it('says the entry was moved and flags the item to check', () => {
    writeDraft('g2', movedEntry, { movedFrom: 'Hartley House' });
    renderEditor({ group: trip });
    expect(screen.getByText('Moved your entry here. Paid by reset to you.')).toBeInTheDocument();
    expect(screen.queryByText('Resumed your unsaved entry.')).toBeNull();
    expect(screen.getByText('Check category: Groceries')).toBeInTheDocument();
  });

  it('never writes the check flag to Firestore', async () => {
    writeDraft('g2', movedEntry, { movedFrom: 'Hartley House' });
    renderEditor({ group: trip });
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(batchSets.length).toBeGreaterThan(0));
    for (const data of batchSets) expect(data).not.toHaveProperty('categoryUnconfirmed');
  });

  it('announces the move and puts focus on Change', () => {
    writeDraft('g2', movedEntry, { movedFrom: 'Hartley House' });
    renderEditor({ group: trip });
    expect(screen.getByRole('status')).toHaveTextContent('Moved your entry here');
    expect(screen.getByRole('button', { name: /change group/i })).toHaveFocus();
  });

  it('puts focus on Change once the categories finish loading', () => {
    writeDraft('g2', movedEntry, { movedFrom: 'Hartley House' });
    catsState.loading = true;
    const { rerender } = renderEditor({ group: trip });
    expect(screen.queryByRole('button', { name: /change group/i })).toBeNull();

    catsState.loading = false;
    rerender(
      <MemoryRouter>
        <ExpenseEditor group={trip} groups={[home, trip]} user={user} currentUserUid="mike" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /change group/i })).toHaveFocus();
  });
});

describe('ExpenseEditor and a pending invite', () => {
  it('drops a pending joined group when the user picks a group here', async () => {
    useUIStore.setState({ pendingGroupId: 'g9' });
    renderEditor();
    await chooseGroup(/Tasmania trip/);
    expect(useUIStore.getState().selectedGroupId).toBe('g2');
    expect(useUIStore.getState().pendingGroupId).toBeNull();
  });
});
