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
  giftCardAmount?: number; // cents — net-to-split = total - giftCardAmount
}
export interface ItemDoc {
  id: string; groupId: string; expenseId: string; month: string;
  name: string; categoryId: string; category: string; amount: number; shared: boolean;
  payerUid: Uid; // denormalized from the expense (for collectionGroup summary)
  remark?: string;
}
export interface IncomeDoc { uid: Uid; month: string; amount: number; description?: string; }
export interface SettlementDoc {
  id: string; month: string; fromUid: Uid; toUid: Uid; amount: number;
  paid: boolean; paidAt?: Timestamp; markedByUid?: Uid;
}

export const itemSchema = z.object({
  groupId: z.string(), expenseId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string().min(1), categoryId: z.string(), category: z.string(),
  amount: z.number().int().nonnegative(), shared: z.boolean(), payerUid: z.string(),
  remark: z.string().optional(),
});
