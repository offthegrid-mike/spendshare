import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import { BACKUP_SCHEMA_VERSION, backupFileName, buildBackup, type BackupInput } from './exportBackup';
import { makeExpense, makeGroup, makeItem } from '../test/fixtures';
import type { CategoryDoc, ExpenseDoc, GroupDoc, IncomeDoc, SettlementDoc, SuggestionsDoc } from '../types/models';

const stamp = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as Timestamp;

const baseGroup = makeGroup('g1', 'Hartley House');
const group: GroupDoc = {
  ...baseGroup,
  createdAt: stamp('2026-01-05T09:30:00Z'),
  members: {
    mike: { ...baseGroup.members.mike, joinedAt: stamp('2026-01-05T09:30:00Z') },
    priya: { ...baseGroup.members.priya, joinedAt: stamp('2026-01-07T21:15:00Z'), manual: true },
  },
};

const exportedAt = new Date('2026-10-26T04:05:06Z');

function expense(id: string, overrides: Partial<ExpenseDoc> & { day?: string } = {}): ExpenseDoc {
  return {
    ...makeExpense(id, overrides),
    date: stamp(`${(overrides.day ?? '2026-10-03')}T00:00:00Z`),
    createdAt: stamp('2026-10-03T10:00:00Z'),
    updatedAt: stamp('2026-10-04T11:00:00Z'),
  };
}

const categories: CategoryDoc[] = [
  { id: 'cat-health', name: 'Health', order: 2, archived: false },
  { id: 'cat-groceries', name: 'Groceries', order: 1, archived: false, monthlyBudget: 80000 },
];

const income: IncomeDoc[] = [
  { id: 'inc2', uid: 'priya', month: '2026-10', amount: 500000, description: 'Salary' },
  { id: 'inc1', uid: 'mike', month: '2026-09', amount: 450000 },
];

const settlements: SettlementDoc[] = [
  { id: 's1', month: '2026-09', fromUid: 'priya', toUid: 'mike', amount: 12000, paid: true, paidAt: stamp('2026-10-01T08:00:00Z'), markedByUid: 'mike' },
];

const suggestions: SuggestionsDoc = {
  items: [{ name: 'Milk', categoryId: 'cat-groceries', category: 'Groceries', count: 3, last: { unit: 350, shop: 'Coles', date: '2026-10-03' } }],
  shops: [{ name: 'Coles', count: 3 }],
  tags: [{ name: 'Holiday', count: 1 }],
  updatedAt: stamp('2026-10-05T12:00:00Z'),
};

function input(overrides: Partial<BackupInput> = {}): BackupInput {
  const e1 = expense('e1', { total: 3780, giftCardAmount: 2000, discountPercent: 2 });
  return {
    group,
    categories,
    expenses: [e1],
    itemsByExpense: {
      e1: [
        makeItem('i1', 'e1', { amount: 700, quantity: 2, unitAmount: 350, tags: ['Holiday'], remark: 'Barista' }),
        makeItem('i2', 'e1', { amount: 3080, shared: false }),
      ],
    },
    income,
    settlements,
    suggestions,
    ...overrides,
  };
}

describe('buildBackup', () => {
  it('says what version of the file it is and when it was made', () => {
    const backup = buildBackup(input(), exportedAt);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe('2026-10-26T04:05:06.000Z');
  });

  it('keeps the group as stored, with the dates as ISO strings', () => {
    const { group: out } = buildBackup(input(), exportedAt);
    expect(out).toMatchObject({
      id: 'g1', name: 'Hartley House', currency: 'AUD', ownerUid: 'mike', memberUids: ['mike', 'priya'],
      createdAt: '2026-01-05T09:30:00.000Z',
    });
    expect(out.members.mike).toEqual({ role: 'owner', displayName: 'Mike', joinedAt: '2026-01-05T09:30:00.000Z' });
    expect(out.members.priya).toEqual({ role: 'member', displayName: 'Priya', joinedAt: '2026-01-07T21:15:00.000Z', manual: true });
  });

  it('leaves every member email out', () => {
    const json = JSON.stringify(buildBackup(input(), exportedAt));
    expect(json).not.toContain('@');
    expect(json).not.toContain('"email"');
  });

  it("does not change what it was given, emails included", () => {
    buildBackup(input(), exportedAt);
    expect(group.members.mike.email).toBe('mike@example.com');
  });

  it("nests each expense's items, keeping every id and field as stored", () => {
    const { expenses } = buildBackup(input(), exportedAt);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      id: 'e1', groupId: 'g1', month: '2026-10', shopName: 'Shop e1', payerUid: 'mike', total: 3780, itemCount: 1,
      createdByUid: 'mike', giftCardAmount: 2000, discountPercent: 2,
      date: '2026-10-03T00:00:00.000Z', createdAt: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-04T11:00:00.000Z',
    });
    expect(expenses[0].items).toEqual([
      {
        id: 'i1', groupId: 'g1', expenseId: 'e1', month: '2026-10', name: 'Item i1', categoryId: 'cat-groceries',
        category: 'Groceries', amount: 700, shared: true, payerUid: 'mike', remark: 'Barista', quantity: 2,
        unitAmount: 350, tags: ['Holiday'],
      },
      {
        id: 'i2', groupId: 'g1', expenseId: 'e1', month: '2026-10', name: 'Item i2', categoryId: 'cat-groceries',
        category: 'Groceries', amount: 3080, shared: false, payerUid: 'mike',
      },
    ]);
  });

  it('keeps a refund as stored: positive amounts, with its kind and what it refunds', () => {
    const r1 = expense('r1', { kind: 'refund', refundOf: 'e1', day: '2026-10-09' });
    const { expenses } = buildBackup(
      input({ expenses: [r1], itemsByExpense: { r1: [makeItem('i9', 'r1', { amount: 700, refund: true })] } }),
      exportedAt,
    );
    expect(expenses[0]).toMatchObject({ kind: 'refund', refundOf: 'e1' });
    expect(expenses[0].items[0]).toMatchObject({ amount: 700, refund: true });
  });

  it('gives an expense with no items an empty list', () => {
    const { expenses } = buildBackup(input({ itemsByExpense: {} }), exportedAt);
    expect(expenses[0].items).toEqual([]);
  });

  it('orders expenses by date then id, items by id, and categories by their order', () => {
    const late = expense('a', { day: '2026-10-20' });
    const early2 = expense('c', { day: '2026-10-02' });
    const early1 = expense('b', { day: '2026-10-02' });
    const backup = buildBackup(
      input({
        expenses: [late, early2, early1],
        itemsByExpense: { b: [makeItem('i9', 'b'), makeItem('i3', 'b')] },
      }),
      exportedAt,
    );
    expect(backup.expenses.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(backup.expenses[0].items.map((i) => i.id)).toEqual(['i3', 'i9']);
    expect(backup.categories.map((c) => c.id)).toEqual(['cat-groceries', 'cat-health']);
  });

  it('keeps categories, income and settlements as stored, with dates as ISO strings', () => {
    const backup = buildBackup(input(), exportedAt);
    expect(backup.categories[0]).toEqual({ id: 'cat-groceries', name: 'Groceries', order: 1, archived: false, monthlyBudget: 80000 });
    expect(backup.income).toEqual([
      { id: 'inc1', uid: 'mike', month: '2026-09', amount: 450000 },
      { id: 'inc2', uid: 'priya', month: '2026-10', amount: 500000, description: 'Salary' },
    ]);
    expect(backup.settlements).toEqual([
      { id: 's1', month: '2026-09', fromUid: 'priya', toUid: 'mike', amount: 12000, paid: true, paidAt: '2026-10-01T08:00:00.000Z', markedByUid: 'mike' },
    ]);
  });

  it('keeps the autocomplete suggestions, or null when there are none', () => {
    expect(buildBackup(input(), exportedAt).suggestions).toEqual({ ...suggestions, updatedAt: '2026-10-05T12:00:00.000Z' });
    expect(buildBackup(input({ suggestions: null }), exportedAt).suggestions).toBeNull();
  });

  it('is plain JSON: nothing is lost or changed by writing it out and reading it back', () => {
    const backup = buildBackup(input(), exportedAt);
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });
});

describe('backupFileName', () => {
  it('names the group and the day', () => {
    expect(backupFileName(group, new Date(2026, 9, 26, 12))).toBe('spendshare-hartley-house-backup-2026-10-26.json');
  });
});
