import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { groupsCol } from './converters';
import { seedDefaultCategories } from './seedCategories';
import { settleWrite } from './settleWrite';
import type { GroupDoc } from '../types/models';

export const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'] as const;

interface CreateOptions {
  /** Fields a trip adds to the group doc. */
  extra?: Pick<GroupDoc, 'kind' | 'trip'>;
  /** Category names to seed instead of the household defaults. */
  categories?: readonly string[];
}

/**
 * Creates a group owned by `user`, seeds its default categories, and returns its id.
 * Offline it returns at once: both writes are already in the local cache, and
 * settleWrite raises a notice if the server refuses them later.
 */
export async function createGroup(
  user: User,
  input: { name: string; currency: string },
  options: CreateOptions = {},
): Promise<string> {
  const now = serverTimestamp();
  const ref = doc(groupsCol);
  await settleWrite(setDoc(ref, {
    id: '',
    name: input.name.trim(),
    currency: input.currency,
    ownerUid: user.uid,
    members: {
      [user.uid]: {
        role: 'owner' as const,
        displayName: user.displayName ?? user.email ?? '',
        email: (user.email ?? '').toLowerCase(),
        joinedAt: now,
      },
    },
    memberUids: [user.uid],
    createdAt: now,
    ...options.extra,
  }));
  await settleWrite(options.categories ? seedDefaultCategories(ref.id, options.categories) : seedDefaultCategories(ref.id));
  return ref.id;
}
