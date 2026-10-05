import { addDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { groupsCol } from './converters';
import { seedDefaultCategories } from './seedCategories';

export const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'] as const;

/** Creates a group owned by `user`, seeds its default categories, and returns its id. */
export async function createGroup(user: User, input: { name: string; currency: string }): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(groupsCol, {
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
  });
  await seedDefaultCategories(ref.id);
  return ref.id;
}
