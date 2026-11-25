import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => {
  const ops: unknown[][] = [];
  let n = 0;
  return {
    ops,
    reset() { ops.length = 0; n = 0; },
    writeBatch: vi.fn(() => ({
      set: (ref: unknown, data: unknown) => ops.push(['set', ref, data]),
      delete: (ref: unknown) => ops.push(['delete', ref]),
      commit: vi.fn(() => Promise.resolve()),
    })),
    doc: vi.fn((col: { path: string }, id?: string) => ({ path: `${col.path}/${id ?? `new${++n}`}`, id: id ?? `new${n}` })),
    updateDoc: vi.fn(() => Promise.resolve()),
  };
});
vi.mock('firebase/firestore', () => ({
  writeBatch: fs.writeBatch,
  doc: fs.doc,
  updateDoc: fs.updateDoc,
  serverTimestamp: () => 'TS',
  Timestamp: { fromDate: (d: Date) => ({ date: d }) },
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  expensesCol: (gid: string) => ({ path: `groups/${gid}/expenses` }),
  itemsCol: (gid: string, eid: string) => ({ path: `groups/${gid}/expenses/${eid}/items` }),
}));

import { saveTripExpense, recordCharge, deleteTripExpense } from './tripWrite';
import { makeExpense, makeItem } from '../../test/fixtures';
import type { BuiltTripExpense } from '../../lib/travel/tripExpense';

const built: BuiltTripExpense = {
  date: '2027-05-12', shopName: 'Ichiran', payerUid: 'alex', currency: 'JPY', rate: 99, total: 6000,
  items: [
    { name: 'Ramen', categoryId: 'food', amount: 4500, shared: true, sharedWith: ['alex', 'ben'] },
    { name: 'Souvenir', categoryId: 'shop', amount: 1500, shared: false },
  ],
};
const categories = { food: 'Food', shop: 'Shopping' };

beforeEach(() => {
  fs.reset();
  fs.updateDoc.mockClear();
});

describe('saveTripExpense', () => {
  it('writes a new expense on the trip day at noon, with an estimated card rate, and its items', async () => {
    const id = await saveTripExpense({ tripId: 'japan', uid: 'alex', home: 'AUD', built, categories });
    expect(id).toBe('new1');
    const [expOp, ...itemOps] = fs.ops;
    expect(expOp[1]).toEqual({ path: 'groups/japan/expenses/new1', id: 'new1' });
    expect(expOp[2]).toEqual({
      groupId: 'japan', date: { date: new Date(2027, 4, 12, 12) }, month: '2027-05', shopName: 'Ichiran',
      payerUid: 'alex', total: 6000, itemCount: 2, createdByUid: 'alex', createdAt: 'TS', updatedAt: 'TS',
      currency: 'JPY', paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' }, tripDay: '2027-05-12',
    });
    expect(itemOps.map((op) => op[2])).toEqual([
      { groupId: 'japan', expenseId: 'new1', month: '2027-05', name: 'Ramen', categoryId: 'food', category: 'Food',
        amount: 4500, shared: true, payerUid: 'alex', sharedWith: ['alex', 'ben'] },
      { groupId: 'japan', expenseId: 'new1', month: '2027-05', name: 'Souvenir', categoryId: 'shop', category: 'Shopping',
        amount: 1500, shared: false, payerUid: 'alex' },
    ]);
  });

  it('marks a home-currency expense as actual: there is nothing to confirm', async () => {
    await saveTripExpense({ tripId: 'japan', uid: 'alex', home: 'AUD', built: { ...built, currency: 'AUD', rate: 1 }, categories });
    expect((fs.ops[0][2] as { paidWith: unknown }).paidWith).toEqual({ kind: 'card', rate: 1, rateStatus: 'actual' });
  });

  it('replaces an edited expense’s items, keeps its creation time, and records the editor as the author (as the rules require)', async () => {
    const existing = makeExpense('e1', {
      createdByUid: 'ben', createdAt: 'CREATED' as never, currency: 'JPY', total: 6000,
      paidWith: { kind: 'card', rate: 96.7, rateStatus: 'actual', homeTotal: 6200 },
    });
    await saveTripExpense({
      tripId: 'japan', uid: 'alex', home: 'AUD', built, categories,
      existing: { expense: existing, items: [makeItem('old1', 'e1'), makeItem('old2', 'e1')] },
    });
    expect(fs.ops.filter((op) => op[0] === 'delete').map((op) => (op[1] as { path: string }).path))
      .toEqual(['groups/japan/expenses/e1/items/old1', 'groups/japan/expenses/e1/items/old2']);
    const exp = fs.ops.find((op) => op[0] === 'set')![2] as Record<string, unknown>;
    expect(exp.createdAt).toBe('CREATED');
    expect(exp.createdByUid).toBe('alex');
    // Same currency and total: what the card was charged still holds.
    expect(exp.paidWith).toEqual({ kind: 'card', rate: 96.7, rateStatus: 'actual', homeTotal: 6200 });
  });

  it('goes back to an estimate when an edit changes what was paid', async () => {
    const existing = makeExpense('e1', {
      currency: 'JPY', total: 5000, paidWith: { kind: 'card', rate: 96.7, rateStatus: 'actual', homeTotal: 5100 },
    });
    await saveTripExpense({ tripId: 'japan', uid: 'alex', home: 'AUD', built, categories, existing: { expense: existing, items: [] } });
    const exp = fs.ops.find((op) => op[0] === 'set')![2] as Record<string, unknown>;
    expect(exp.paidWith).toEqual({ kind: 'card', rate: 99, rateStatus: 'estimated' });
  });
});

describe('recordCharge', () => {
  it('stores the amount charged and the rate it implies', async () => {
    await recordCharge('japan', makeExpense('e1', { currency: 'JPY', total: 15000, createdByUid: 'ben' }), 15510, 'AUD', 'alex');
    const [ref, patch] = fs.updateDoc.mock.calls[0] as unknown as [{ path: string }, { paidWith: { rate: number } }];
    expect(ref.path).toBe('groups/japan/expenses/e1');
    expect(patch).toEqual({
      paidWith: { kind: 'card', rate: expect.closeTo(96.7118, 4), rateStatus: 'actual', homeTotal: 15510 },
      updatedAt: 'TS',
      createdByUid: 'alex',
    });
  });
});

describe('deleteTripExpense', () => {
  it('deletes the expense and its items together', async () => {
    await deleteTripExpense('japan', 'e1', ['i1', 'i2']);
    expect(fs.ops.map((op) => (op[1] as { path: string }).path)).toEqual([
      'groups/japan/expenses/e1/items/i1', 'groups/japan/expenses/e1/items/i2', 'groups/japan/expenses/e1',
    ]);
  });
});
