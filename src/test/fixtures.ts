import type { ExpenseDoc, GroupDoc, GroupMember, ItemDoc } from '../types/models';

function member(displayName: string, role: GroupMember['role'] = 'member'): GroupMember {
  return { role, displayName, email: `${displayName.toLowerCase()}@example.com`, joinedAt: null as unknown as GroupMember['joinedAt'] };
}

/** A group whose members are keyed by lowercase name as uid ('mike', 'priya'). */
export function makeGroup(id: string, name: string, memberNames: string[] = ['Mike', 'Priya']): GroupDoc {
  const members = Object.fromEntries(memberNames.map((n, i) => [n.toLowerCase(), member(n, i === 0 ? 'owner' : 'member')]));
  return {
    id, name, currency: 'AUD', ownerUid: memberNames[0].toLowerCase(),
    members, memberUids: Object.keys(members),
    createdAt: null as unknown as GroupDoc['createdAt'],
  };
}


/** An expense on the given local date ('YYYY-MM-DD'); total defaults to 1000 cents. */
export function makeExpense(id: string, overrides: Partial<ExpenseDoc> & { day?: string } = {}): ExpenseDoc {
  const { day = '2026-10-03', ...rest } = overrides;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return {
    id, groupId: 'g1', month: day.slice(0, 7), shopName: `Shop ${id}`, payerUid: 'mike',
    total: 1000, itemCount: 1, createdByUid: 'mike',
    date: { toDate: () => date, toMillis: () => date.getTime() } as unknown as ExpenseDoc['date'],
    createdAt: null as unknown as ExpenseDoc['createdAt'],
    updatedAt: null as unknown as ExpenseDoc['updatedAt'],
    ...rest,
  };
}

export function makeItem(id: string, expenseId: string, overrides: Partial<ItemDoc> = {}): ItemDoc {
  return {
    id, groupId: 'g1', expenseId, month: '2026-10', name: `Item ${id}`,
    categoryId: 'cat-groceries', category: 'Groceries', amount: 1000, shared: true, payerUid: 'mike',
    ...overrides,
  };
}
