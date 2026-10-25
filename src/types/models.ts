import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type Uid = string;
export type Role = 'owner' | 'member';

export interface UserDoc {
  uid: Uid; email: string; displayName: string; photoURL?: string;
  memberOf: string[]; createdAt: Timestamp;
}
export interface GroupMember { role: Role; displayName: string; email: string; joinedAt: Timestamp; manual?: boolean; }
export interface GroupDoc {
  id: string; name: string; currency: string; ownerUid: Uid;
  members: Record<Uid, GroupMember>; memberUids: Uid[]; createdAt: Timestamp;
}
export interface InviteDoc {
  email: string; invitedByUid: Uid; invitedByName: string; groupName: string;
  status: 'pending' | 'accepted' | 'revoked' | 'declined'; createdAt: Timestamp;
}
export interface CategoryDoc { id: string; name: string; order: number; archived: boolean; }
export interface ExpenseDoc {
  id: string; groupId: string; date: Timestamp; month: string; shopName: string;
  payerUid: Uid; total: number; itemCount: number; createdByUid: Uid;
  createdAt: Timestamp; updatedAt: Timestamp;
  giftCardAmount?: number; // cents; display-only, settlement uses item amounts (see lib/adjustment.ts)
  discountPercent?: number; // percent (e.g. 2 or 2.5) — see computeDiscountCents in lib/discount.ts
  kind?: 'refund';          // missing for a purchase; amounts stay positive (see lib/refund.ts)
  refundOf?: string;        // a refund's original expense id
}
export interface ItemDoc {
  id: string; groupId: string; expenseId: string; month: string;
  name: string; categoryId: string; category: string; amount: number; shared: boolean;
  payerUid: Uid; // denormalized from the expense (for collectionGroup summary)
  remark?: string;
  quantity?: number;   // count (default 1); amount is the line total = unitAmount * quantity
  unitAmount?: number; // per-item price in cents (default: same as amount when quantity is 1)
  refund?: boolean;    // denormalized from the expense's kind, so item-only sums can subtract it
}
export interface IncomeDoc { id?: string; uid: Uid; month: string; amount: number; description?: string; }
export interface SettlementDoc {
  id: string; month: string; fromUid: Uid; toUid: Uid; amount: number;
  paid: boolean; paidAt?: Timestamp; markedByUid?: Uid;
}

export interface SuggestionEntry {
  name: string;
  categoryId: string;
  category: string;
  count: number;
}

export interface ShopEntry { name: string; count: number; }

export interface SuggestionsDoc {
  items: SuggestionEntry[];
  shops: ShopEntry[];
  updatedAt: Timestamp;
}

export type WorkDayType = 'home' | 'office' | 'leave';

export interface WorkRevision {
  at: Timestamp;                       // device clock; serverTimestamp cannot go inside an array
  kind: 'save' | 'confirm' | 'include' | 'exclude';
  type: WorkDayType | null;
  startTime?: string; finishTime?: string; minutes?: number;
  addedLater: boolean; countedInClaim: boolean; finishConfirmed: boolean;
}

export interface WorkDayDoc {
  date: string;                        // 'YYYY-MM-DD' (= document id)
  incomeYear: string;                  // '2026-27'
  type: WorkDayType | null;            // null = cleared
  startTime?: string; finishTime?: string; minutes?: number;   // home only
  addedLater: boolean;
  countedInClaim: boolean;
  finishConfirmed: boolean;
  finishConfirmedAt?: Timestamp;
  firstRecordedAt: Timestamp;
  recordedAt: Timestamp;               // latest change of type or times
  syncedAt: Timestamp | null;          // serverTimestamp() of the latest write; null until the server acknowledges it
  revisions: WorkRevision[];           // append-only
}

export interface WorkSettingsDoc {
  workWeekdays: number[];              // ISO 1 (Mon) to 7 (Sun)
  defaultMinutes: number;
  ratesCentsPerHour: Record<string, number>;
  trackingStartDate: string | null;
}

export const itemSchema = z.object({
  groupId: z.string(), expenseId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string().min(1), categoryId: z.string(), category: z.string(),
  amount: z.number().int().nonnegative(), shared: z.boolean(), payerUid: z.string(),
  remark: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  unitAmount: z.number().int().nonnegative().optional(),
  refund: z.boolean().optional(),
});
