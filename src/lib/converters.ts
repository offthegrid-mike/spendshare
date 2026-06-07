import {
  collection,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  UserDoc, GroupDoc, ExpenseDoc, ItemDoc, IncomeDoc,
  CategoryDoc, InviteDoc, SettlementDoc,
} from '../types/models';

function col<T extends DocumentData>(path: string): CollectionReference<T> {
  return collection(db, path) as CollectionReference<T>;
}

export const usersCol = col<UserDoc>('users');
export const groupsCol = col<GroupDoc>('groups');
export const expensesCol = (gid: string) => col<ExpenseDoc>(`groups/${gid}/expenses`);
export const itemsCol = (gid: string, eid: string) => col<ItemDoc>(`groups/${gid}/expenses/${eid}/items`);
export const incomeCol = (gid: string) => col<IncomeDoc>(`groups/${gid}/income`);
export const categoriesCol = (gid: string) => col<CategoryDoc>(`groups/${gid}/categories`);
export const invitesCol = (gid: string) => col<InviteDoc>(`groups/${gid}/invites`);
export const settlementsCol = (gid: string) => col<SettlementDoc>(`groups/${gid}/settlements`);
