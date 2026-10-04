import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setDoc, deleteDoc, doc, serverTimestamp, settlementsCol } = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((col: { path: string }, id: string) => ({ path: `${col.path}/${id}` })),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  settlementsCol: vi.fn((gid: string) => ({ path: `groups/${gid}/settlements` })),
}));
vi.mock('firebase/firestore', () => ({ setDoc, deleteDoc, doc, serverTimestamp }));
vi.mock('./converters', () => ({ settlementsCol }));

import { markSettlementPaid, undoSettlement } from './settle';

beforeEach(() => vi.clearAllMocks());

describe('markSettlementPaid', () => {
  it('writes the paid settlement under month_from_to', async () => {
    await markSettlementPaid('g1', '2026-10', { fromUid: 'priya', toUid: 'mike', amount: 8829 }, 'mike');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'groups/g1/settlements/2026-10_priya_mike' },
      {
        id: '2026-10_priya_mike',
        month: '2026-10',
        fromUid: 'priya',
        toUid: 'mike',
        amount: 8829,
        paid: true,
        paidAt: 'SERVER_TS',
        markedByUid: 'mike',
      },
    );
  });
});

describe('markSettlementPaid after an earlier settle-up the same month', () => {
  it('adds to the paid settlement in the same direction instead of replacing it', async () => {
    const earlier = { id: '2026-10_priya_mike', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 8829, paid: true };
    await markSettlementPaid('g1', '2026-10', { fromUid: 'priya', toUid: 'mike', amount: 1200 }, 'mike', [earlier]);
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'groups/g1/settlements/2026-10_priya_mike' },
      expect.objectContaining({ amount: 10029 }),
    );
  });

  it('ignores settlements in the other direction', async () => {
    const reverse = { id: '2026-10_mike_priya', month: '2026-10', fromUid: 'mike', toUid: 'priya', amount: 500, paid: true };
    await markSettlementPaid('g1', '2026-10', { fromUid: 'priya', toUid: 'mike', amount: 1200 }, 'mike', [reverse]);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 1200 }));
  });
});

describe('undoSettlement', () => {
  it('deletes the settlement doc', async () => {
    await undoSettlement('g1', '2026-10_priya_mike');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'groups/g1/settlements/2026-10_priya_mike' });
  });
});
