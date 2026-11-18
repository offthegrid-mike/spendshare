import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = { id: string } & Record<string, unknown>;
type Constraint = { field: string; op: string; value: unknown };
type Q = { ref: { path: string }; constraints: Constraint[] } | { path: string };

const { getDocsFromServer, getDocFromServer } = vi.hoisted(() => ({
  getDocsFromServer: vi.fn(),
  getDocFromServer: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collectionGroup: (_db: unknown, id: string) => ({ path: `*/${id}` }),
  query: (ref: { path: string }, ...constraints: Constraint[]) => ({ ref, constraints }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  getDocsFromServer: (q: Q) => getDocsFromServer(q),
  getDocFromServer: (ref: unknown) => getDocFromServer(ref),
}));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./converters', () => ({
  expensesCol: (gid: string) => ({ path: `groups/${gid}/expenses` }),
  categoriesCol: (gid: string) => ({ path: `groups/${gid}/categories` }),
  incomeCol: (gid: string) => ({ path: `groups/${gid}/income` }),
  settlementsCol: (gid: string) => ({ path: `groups/${gid}/settlements` }),
  suggestionsDocRef: (gid: string) => ({ path: `groups/${gid}/suggestions/index` }),
}));

import { ExportError, loadBackupData, loadPeriodData } from './exportData';

const pathOf = (q: Q) => ('ref' in q ? q.ref.path : q.path);
const constraintsOf = (q: Q) => ('ref' in q ? q.constraints : []);

const snapshot = (docs: Doc[]) => ({
  docs: docs.map(({ id, ...data }) => ({ id, data: () => data })),
});

/** What each collection holds; a read of one that isn't listed is empty. */
let stored: Record<string, Doc[]>;

function readsFrom(fail?: (q: Q) => unknown) {
  getDocsFromServer.mockImplementation((q: Q) => {
    const failure = fail?.(q);
    return failure ? Promise.reject(failure) : Promise.resolve(snapshot(stored[pathOf(q)] ?? []));
  });
}

const offline = () => Object.assign(new Error('Failed to get documents from server.'), { code: 'unavailable' });

beforeEach(() => {
  vi.clearAllMocks();
  stored = {
    'groups/g1/expenses': [{ id: 'e1', month: '2026-10', shopName: 'Coles' }, { id: 'e2', month: '2026-10', shopName: 'Aldi' }],
    '*/items': [
      { id: 'i1', expenseId: 'e1', groupId: 'g1', month: '2026-10', name: 'Milk' },
      { id: 'i2', expenseId: 'e1', groupId: 'g1', month: '2026-10', name: 'Bread' },
      { id: 'i3', expenseId: 'e2', groupId: 'g1', month: '2026-10', name: 'Eggs' },
    ],
    'groups/g1/categories': [{ id: 'cat-groceries', name: 'Groceries', order: 1, archived: false }],
    'groups/g1/income': [{ id: 'inc1', uid: 'mike', month: '2026-10', amount: 450000 }],
    'groups/g1/settlements': [{ id: 's1', month: '2026-09', amount: 100 }],
  };
  readsFrom();
  getDocFromServer.mockResolvedValue({ exists: () => true, data: () => ({ items: [], shops: [] }) });
});

describe('loadPeriodData', () => {
  it("reads a month's expenses and items, grouping the items by expense, with the document ids", async () => {
    const data = await loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    expect(data.expenses.map((e) => [e.id, e.shopName])).toEqual([['e1', 'Coles'], ['e2', 'Aldi']]);
    expect(Object.keys(data.itemsByExpense).sort()).toEqual(['e1', 'e2']);
    expect(data.itemsByExpense.e1.map((i) => [i.id, i.name])).toEqual([['i1', 'Milk'], ['i2', 'Bread']]);
    expect(data.itemsByExpense.e2.map((i) => i.id)).toEqual(['i3']);
  });

  it('asks only for that month, expenses and items alike', async () => {
    await loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    const queries = getDocsFromServer.mock.calls.map(([q]) => q as Q);
    const expenses = queries.find((q) => pathOf(q) === 'groups/g1/expenses')!;
    const items = queries.find((q) => pathOf(q) === '*/items')!;
    expect(constraintsOf(expenses)).toEqual([
      { field: 'month', op: '>=', value: '2026-10' },
      { field: 'month', op: '<=', value: '2026-10' },
    ]);
    expect(constraintsOf(items)).toEqual([
      { field: 'groupId', op: '==', value: 'g1' },
      { field: 'month', op: '>=', value: '2026-10' },
      { field: 'month', op: '<=', value: '2026-10' },
    ]);
  });

  it('asks for January to December for a year', async () => {
    await loadPeriodData('g1', { kind: 'year', year: '2026' });
    const queries = getDocsFromServer.mock.calls.map(([q]) => q as Q);
    for (const q of queries) {
      const months = constraintsOf(q).filter((c) => c.field === 'month').map((c) => c.value);
      expect(months).toEqual(['2026-01', '2026-12']);
    }
  });

  it('reads nothing but the two collections', async () => {
    await loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    expect(getDocsFromServer).toHaveBeenCalledTimes(2);
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('is empty for a period with nothing in it', async () => {
    stored = {};
    const data = await loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    expect(data).toEqual({ expenses: [], itemsByExpense: {} });
  });

  it("says it couldn't reach the server when the expenses can't be read", async () => {
    readsFrom((q) => (pathOf(q) === 'groups/g1/expenses' ? offline() : null));
    const failure = loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    await expect(failure).rejects.toBeInstanceOf(ExportError);
    await expect(failure).rejects.toThrow("Couldn't reach the server");
  });

  it("says it couldn't reach the server when the items can't be read", async () => {
    readsFrom((q) => (pathOf(q) === '*/items' ? offline() : null));
    await expect(loadPeriodData('g1', { kind: 'month', month: '2026-10' })).rejects.toThrow("Couldn't reach the server");
  });

  it('says so plainly for any other failure, not showing the raw error', async () => {
    readsFrom((q) => (pathOf(q) === '*/items' ? Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }) : null));
    const failure = loadPeriodData('g1', { kind: 'month', month: '2026-10' });
    await expect(failure).rejects.toBeInstanceOf(ExportError);
    await expect(failure).rejects.toThrow("Couldn't read your data");
    await expect(failure).rejects.not.toThrow('permissions');
  });
});

describe('loadBackupData', () => {
  it('reads the whole group: expenses, items, categories, income, settlements and suggestions', async () => {
    const suggestions = { items: [], shops: [], updatedAt: 'T' };
    getDocFromServer.mockResolvedValue({ exists: () => true, data: () => suggestions });
    const data = await loadBackupData('g1');
    expect(data.expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(Object.keys(data.itemsByExpense).sort()).toEqual(['e1', 'e2']);
    expect(data.categories).toEqual([{ id: 'cat-groceries', name: 'Groceries', order: 1, archived: false }]);
    expect(data.income).toEqual([{ id: 'inc1', uid: 'mike', month: '2026-10', amount: 450000 }]);
    expect(data.settlements).toEqual([{ id: 's1', month: '2026-09', amount: 100 }]);
    expect(data.suggestions).toEqual(suggestions);
  });

  it('asks for all of the group, with no month range', async () => {
    await loadBackupData('g1');
    const items = getDocsFromServer.mock.calls.map(([q]) => q as Q).find((q) => pathOf(q) === '*/items')!;
    expect(constraintsOf(items)).toEqual([{ field: 'groupId', op: '==', value: 'g1' }]);
    expect(getDocFromServer).toHaveBeenCalledWith({ path: 'groups/g1/suggestions/index' });
  });

  it('has no suggestions when the group has none yet', async () => {
    getDocFromServer.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect((await loadBackupData('g1')).suggestions).toBeNull();
  });

  it("says it couldn't reach the server when any one read fails", async () => {
    readsFrom((q) => (pathOf(q) === 'groups/g1/income' ? offline() : null));
    await expect(loadBackupData('g1')).rejects.toThrow("Couldn't reach the server");
  });

  it("says it couldn't reach the server when only the suggestions fail", async () => {
    getDocFromServer.mockRejectedValue(offline());
    await expect(loadBackupData('g1')).rejects.toThrow("Couldn't reach the server");
  });
});
