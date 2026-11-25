import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => {
  const ops: unknown[][] = [];
  return {
    ops,
    writeBatch: vi.fn(() => ({
      set: (ref: unknown, data: unknown) => ops.push(['set', ref, data]),
      commit: vi.fn(() => Promise.resolve()),
    })),
    doc: vi.fn((col: { path: string }, id?: string) => ({ path: `${col.path}/${id ?? 'new'}`, id: id ?? 'new' })),
    deleteDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
  };
});
vi.mock('firebase/firestore', () => ({
  writeBatch: fs.writeBatch, doc: fs.doc, deleteDoc: fs.deleteDoc, updateDoc: fs.updateDoc, serverTimestamp: () => 'TS',
  deleteField: () => 'DELETE',
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  walletsCol: (gid: string) => ({ path: `groups/${gid}/wallets` }),
  topUpsCol: (gid: string) => ({ path: `groups/${gid}/topUps` }),
  handoversCol: (gid: string) => ({ path: `groups/${gid}/handovers` }),
}));

import { addCash, deleteTopUp, handOverCash, setKittyKeeper, undoHandover } from './cashWrite';

beforeEach(() => { fs.ops.length = 0; });

const input = { tripId: 'japan', uid: 'alex', ownerUid: 'ben', currency: 'JPY', foreignAmount: 50000, homeAmount: 53000, date: '2027-05-09' };

describe('addCash', () => {
  it('creates the owner’s wallet for that currency and records the cash in one batch', async () => {
    await addCash({ ...input, walletExists: false });
    expect(fs.ops).toEqual([
      ['set', { path: 'groups/japan/wallets/ben_JPY', id: 'ben_JPY' },
        { id: 'ben_JPY', kind: 'personal', ownerUid: 'ben', currency: 'JPY', createdByUid: 'alex', createdAt: 'TS' }],
      ['set', { path: 'groups/japan/topUps/new', id: 'new' },
        { id: 'new', walletId: 'ben_JPY', byUid: 'alex', date: '2027-05-09', foreignAmount: 50000, homeAmount: 53000, createdAt: 'TS' }],
    ]);
  });

  it('leaves an existing wallet as it is', async () => {
    await addCash({ ...input, walletExists: true });
    expect(fs.ops.map((op) => (op[1] as { path: string }).path)).toEqual(['groups/japan/topUps/new']);
  });
});

describe('addCash to the kitty', () => {
  it('starts the kitty for that currency and records who put the money in', async () => {
    await addCash({ tripId: 'japan', uid: 'alex', kitty: true, fromUid: 'ben', currency: 'JPY', foreignAmount: 30000, homeAmount: 30000, date: '2027-05-09', walletExists: false });
    expect(fs.ops).toEqual([
      ['set', { path: 'groups/japan/wallets/kitty_JPY', id: 'kitty_JPY' },
        { id: 'kitty_JPY', kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: 'TS' }],
      ['set', { path: 'groups/japan/topUps/new', id: 'new' },
        { id: 'new', walletId: 'kitty_JPY', byUid: 'alex', fromUid: 'ben', date: '2027-05-09', foreignAmount: 30000, homeAmount: 30000, createdAt: 'TS' }],
    ]);
  });
});

describe('deleteTopUp', () => {
  it('deletes the top-up', async () => {
    await deleteTopUp('japan', 't1');
    expect(fs.deleteDoc).toHaveBeenCalledWith({ path: 'groups/japan/topUps/t1', id: 't1' });
  });
});

describe('handOverCash', () => {
  it('records the hand-over, creating the receiver’s wallet in that currency if they have none', async () => {
    await handOverCash({ tripId: 'japan', uid: 'ben', fromUid: 'ben', toUid: 'alex', currency: 'JPY', foreignAmount: 20000, date: '2027-05-20', receiverHasWallet: false });
    expect(fs.ops).toEqual([
      ['set', { path: 'groups/japan/wallets/alex_JPY', id: 'alex_JPY' },
        { id: 'alex_JPY', kind: 'personal', ownerUid: 'alex', currency: 'JPY', createdByUid: 'ben', createdAt: 'TS' }],
      ['set', { path: 'groups/japan/handovers/new', id: 'new' },
        { id: 'new', fromUid: 'ben', toUid: 'alex', currency: 'JPY', foreignAmount: 20000, date: '2027-05-20', byUid: 'ben', createdAt: 'TS' }],
    ]);
  });

  it('undoes a hand-over', async () => {
    await undoHandover('japan', 'h1');
    expect(fs.deleteDoc).toHaveBeenCalledWith({ path: 'groups/japan/handovers/h1', id: 'h1' });
  });
});

describe('setKittyKeeper', () => {
  it('sets who keeps the kitty’s leftover, or clears it to hand it back', async () => {
    await setKittyKeeper('japan', 'kitty_JPY', 'chris');
    expect(fs.updateDoc).toHaveBeenLastCalledWith({ path: 'groups/japan/wallets/kitty_JPY', id: 'kitty_JPY' }, { keptBy: 'chris' });
    await setKittyKeeper('japan', 'kitty_JPY', null);
    expect(fs.updateDoc).toHaveBeenLastCalledWith({ path: 'groups/japan/wallets/kitty_JPY', id: 'kitty_JPY' }, { keptBy: 'DELETE' });
  });
});
