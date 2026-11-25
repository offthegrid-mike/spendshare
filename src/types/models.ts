import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type Uid = string;
export type Role = 'owner' | 'member';

export interface UserDoc {
  uid: Uid; email: string; displayName: string; photoURL?: string;
  memberOf: string[]; createdAt: Timestamp;
}
export interface GroupMember { role: Role; displayName: string; email: string; joinedAt: Timestamp; manual?: boolean; }
/** A trip's first and last days, 'YYYY-MM-DD', both included. */
export interface TripDates { startDate: string; endDate: string; }
export interface GroupDoc {
  id: string; name: string;
  currency: string; // a trip's home currency, which balances and settle-up use
  ownerUid: Uid;
  members: Record<Uid, GroupMember>; memberUids: Uid[]; createdAt: Timestamp;
  kind?: 'trip';    // missing = a household; set at creation and never changed (see lib/travel/trips.ts)
  trip?: TripDates; // trips only
}
export interface InviteDoc {
  email: string; invitedByUid: Uid; invitedByName: string; groupName: string;
  groupKind?: 'trip'; // so accepting a trip invite doesn't switch the household
  status: 'pending' | 'accepted' | 'revoked' | 'declined'; createdAt: Timestamp;
}
export interface CategoryDoc {
  id: string; name: string; order: number; archived: boolean;
  monthlyBudget?: number; // cents a month across all spending in the category; missing means no budget (see lib/budget.ts)
}
export interface ExpenseDoc {
  id: string; groupId: string; date: Timestamp; month: string; shopName: string;
  payerUid: Uid; total: number; itemCount: number; createdByUid: Uid;
  createdAt: Timestamp; updatedAt: Timestamp;
  giftCardAmount?: number; // cents; display-only, settlement uses item amounts (see lib/adjustment.ts)
  discountPercent?: number; // percent (e.g. 2 or 2.5) — see computeDiscountCents in lib/discount.ts
  kind?: 'refund';          // missing for a purchase; amounts stay positive (see lib/refund.ts)
  refundOf?: string;        // a refund's original expense id
  // Trips only (see lib/travel/tripExpense.ts). On a trip, total and item amounts
  // are minor units of `currency`, not of the group's (home) currency.
  currency?: string;        // missing = the group's currency
  paidWith?: TripPayment;
  tripDay?: string;         // 'YYYY-MM-DD' as chosen; `date` read in another time zone can fall on another day
}

/**
 * How a trip expense was paid. A card payment carries its rate as "1 home =
 * rate foreign", estimated until the amount actually charged (homeTotal, in
 * home minor units) is entered. A wallet payment (T4) is valued at the wallet's rate.
 */
export type TripPayment =
  | { kind: 'card'; rate: number; rateStatus: 'estimated' | 'actual'; homeTotal?: number }
  | { kind: 'wallet'; walletId: string };
export interface ItemDoc {
  id: string; groupId: string; expenseId: string; month: string;
  name: string; categoryId: string; category: string; amount: number; shared: boolean;
  payerUid: Uid; // denormalized from the expense (for collectionGroup summary)
  remark?: string;
  quantity?: number;   // count (default 1); amount is the line total = unitAmount * quantity
  unitAmount?: number; // per-item price in cents (default: same as amount when quantity is 1)
  refund?: boolean;    // denormalized from the expense's kind, so item-only sums can subtract it
  tags?: string[];     // as typed; matched by lib/tags tagKey; at most MAX_TAGS
  sharedWith?: Uid[];  // trips: who shares a shared item; missing = every member (see lib/settlement)
}
/**
 * Cash in one foreign currency (lib/travel/cash.ts): a member's own
 * (groups/{tripId}/wallets/{ownerUid_CUR}, one per person per currency) or the
 * trip's shared kitty (wallets/{kitty_CUR}, no owner; everyone puts money in).
 */
export interface WalletDoc {
  id: string; kind: 'personal' | 'kitty';
  ownerUid?: Uid; // personal only
  currency: string;
  createdByUid: Uid; createdAt: Timestamp;
}
/** Cash put into a wallet: groups/{tripId}/topUps/{id}. Amounts are minor units. */
export interface TopUpDoc {
  id: string; walletId: string; byUid: Uid;
  fromUid?: Uid;         // kitty only: who put the money in (byUid is who recorded it)
  date: string;          // 'YYYY-MM-DD'
  foreignAmount: number; // of the wallet's currency received, > 0
  homeAmount: number;    // of the trip's home currency paid for it, >= 0
  createdAt: Timestamp;
}
export interface IncomeDoc { id?: string; uid: Uid; month: string; amount: number; description?: string; }
export interface SettlementDoc {
  id: string; month: string; fromUid: Uid; toUid: Uid; amount: number;
  paid: boolean; paidAt?: Timestamp; markedByUid?: Uid;
}

/** What one of an item cost the last time it was bought, and where. */
export interface LastPrice {
  /** Cents for one. */
  unit: number;
  /** '' when the expense had no shop. */
  shop: string;
  /** 'YYYY-MM-DD' */
  date: string;
}

export interface SuggestionEntry {
  name: string;
  categoryId: string;
  category: string;
  count: number;
  /** Missing until the item is next bought, or the suggestions are rebuilt. */
  last?: LastPrice;
}

export interface ShopEntry { name: string; count: number; }

export interface SuggestionsDoc {
  items: SuggestionEntry[];
  shops: ShopEntry[];
  /** Tags, each counted once per expense; missing before tags existed. */
  tags?: ShopEntry[];
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
  tags: z.array(z.string()).max(10).optional(), // MAX_TAGS in lib/tags (kept literal: models must not import lib)
  sharedWith: z.array(z.string()).min(1).max(20).optional(),
});
