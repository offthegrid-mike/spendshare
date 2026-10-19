import type { Timestamp } from 'firebase/firestore';
import type { ExpenseDoc, GroupDoc, GroupMember, ItemDoc, WorkDayDoc, WorkSettingsDoc } from '../types/models';

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

const WORK_STAMP = { toDate: () => new Date('2026-10-19T08:00:00Z') } as unknown as Timestamp;

/** Work settings with Monday to Friday as work days, tracking from 1 July 2026. */
export const WORK_SETTINGS: WorkSettingsDoc = {
  workWeekdays: [1, 2, 3, 4, 5],
  defaultMinutes: 456,
  ratesCentsPerHour: {},
  trackingStartDate: '2026-07-01',
};

/** A Home day of 456 minutes from 08:30 to 16:06, recorded on the day and confirmed, unless overridden. */
export function makeWorkDay(date: string, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: true,
    firstRecordedAt: WORK_STAMP,
    recordedAt: WORK_STAMP,
    syncedAt: WORK_STAMP,
    revisions: [],
    ...overrides,
  };
}
