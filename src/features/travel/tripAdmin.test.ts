import { describe, it, expect, vi, beforeEach } from 'vitest';

const { batches, getDocs, updateDoc } = vi.hoisted(() => ({
  batches: [] as { ops: [string, unknown, unknown?][]; commit: ReturnType<typeof vi.fn> }[],
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: () => {
    const b = {
      ops: [] as [string, unknown, unknown?][],
      delete(ref: unknown) { b.ops.push(['delete', ref]); },
      update(ref: unknown, data: unknown) { b.ops.push(['update', ref, data]); },
      commit: vi.fn().mockResolvedValue(undefined),
    };
    batches.push(b);
    return b;
  },
  doc: (col: { path: string }, id: string) => `${col.path}/${id}`,
  getDocs,
  updateDoc,
  deleteField: () => 'DELETE',
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => {
  const col = (path: string) => ({ path });
  return {
    groupsCol: col('groups'),
    expensesCol: (g: string) => col(`groups/${g}/expenses`),
    itemsCol: (g: string, e: string) => col(`groups/${g}/expenses/${e}/items`),
    incomeCol: (g: string) => col(`groups/${g}/income`),
    categoriesCol: (g: string) => col(`groups/${g}/categories`),
    invitesCol: (g: string) => col(`groups/${g}/invites`),
    settlementsCol: (g: string) => col(`groups/${g}/settlements`),
    walletsCol: (g: string) => col(`groups/${g}/wallets`),
    topUpsCol: (g: string) => col(`groups/${g}/topUps`),
    handoversCol: (g: string) => col(`groups/${g}/handovers`),
    suggestionsDocRef: (g: string) => `groups/${g}/suggestions/index`,
  };
});

import { changeTripCurrency, deleteTrip } from './tripAdmin';

/** Snapshots of each collection, by path. */
let data: Record<string, string[]>;

beforeEach(() => {
  batches.length = 0;
  updateDoc.mockReset().mockResolvedValue(undefined);
  data = {};
  getDocs.mockReset().mockImplementation(async (col: { path: string }) => ({
    docs: (data[col.path] ?? []).map((id) => ({ id, ref: `${col.path}/${id}` })),
  }));
});

describe('changeTripCurrency', () => {
  it('sets the home currency with the other changes and removes the empty wallets, in one batch', async () => {
    await changeTripCurrency('taiwan', { name: 'Taiwan', currency: 'AUD' }, ['mike_AUD']);
    expect(batches).toHaveLength(1);
    expect(batches[0].ops).toEqual([
      ['delete', 'groups/taiwan/wallets/mike_AUD'],
      ['update', 'groups/taiwan', { name: 'Taiwan', currency: 'AUD' }],
    ]);
    expect(batches[0].commit).toHaveBeenCalled();
  });
});

describe('deleteTrip', () => {
  it('deletes everything under the trip, each expense’s items, then the trip itself last', async () => {
    data = {
      'groups/taiwan/expenses': ['e1', 'e2'],
      'groups/taiwan/expenses/e1/items': ['i1', 'i2'],
      'groups/taiwan/wallets': ['mike_TWD'],
      'groups/taiwan/topUps': ['t1'],
      'groups/taiwan/handovers': ['h1'],
      'groups/taiwan/settlements': ['s1'],
      'groups/taiwan/invites': ['a@b.com'],
      'groups/taiwan/categories': ['c1'],
    };
    await deleteTrip({ id: 'taiwan' });
    const deleted = batches.flatMap((b) => b.ops.map(([, ref]) => ref));
    expect(deleted).toEqual(expect.arrayContaining([
      'groups/taiwan/expenses/e1/items/i1', 'groups/taiwan/expenses/e1/items/i2',
      'groups/taiwan/expenses/e1', 'groups/taiwan/expenses/e2',
      'groups/taiwan/wallets/mike_TWD', 'groups/taiwan/topUps/t1', 'groups/taiwan/handovers/h1',
      'groups/taiwan/settlements/s1', 'groups/taiwan/invites/a@b.com', 'groups/taiwan/categories/c1',
      'groups/taiwan/suggestions/index',
    ]));
    expect(deleted.at(-1)).toBe('groups/taiwan');
    expect(deleted.filter((r) => r === 'groups/taiwan')).toHaveLength(1);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('keeps each batch within Firestore’s limit', async () => {
    data = { 'groups/big/expenses': Array.from({ length: 1200 }, (_, i) => `e${i}`) };
    await deleteTrip({ id: 'big' });
    expect(batches.length).toBeGreaterThan(2);
    for (const b of batches) expect(b.ops.length).toBeLessThanOrEqual(450);
    expect(batches.flatMap((b) => b.ops)).toHaveLength(1200 + 2);
  });

  it('reopens a closed trip first, since a closed trip’s expenses and cash can’t be deleted', async () => {
    await deleteTrip({ id: 'taiwan', tripClosedAt: 'then' as never });
    expect(updateDoc).toHaveBeenCalledWith('groups/taiwan', { tripClosedAt: 'DELETE' });
    expect(updateDoc.mock.invocationCallOrder[0]).toBeLessThan(batches[0].commit.mock.invocationCallOrder[0]);
  });
});
