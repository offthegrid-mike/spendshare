import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from 'firebase/auth';

const { addDoc, seed } = vi.hoisted(() => ({ addDoc: vi.fn(), seed: vi.fn() }));
vi.mock('firebase/firestore', () => ({ addDoc, serverTimestamp: () => 'TS' }));
vi.mock('./converters', () => ({ groupsCol: 'groupsCol' }));
vi.mock('./seedCategories', () => ({ seedDefaultCategories: seed }));

import { createGroup } from './createGroup';

const user = { uid: 'mike', displayName: 'Mike', email: 'Mike@Example.com' } as unknown as User;

beforeEach(() => {
  addDoc.mockReset().mockResolvedValue({ id: 'g-new' });
  seed.mockReset().mockResolvedValue(undefined);
});

describe('createGroup', () => {
  it('writes an owner-only group with a trimmed name, seeds categories and returns the id', async () => {
    const id = await createGroup(user, { name: '  Tasmania trip ', currency: 'AUD' });

    expect(id).toBe('g-new');
    expect(addDoc).toHaveBeenCalledWith(
      'groupsCol',
      expect.objectContaining({
        name: 'Tasmania trip',
        currency: 'AUD',
        ownerUid: 'mike',
        memberUids: ['mike'],
        members: { mike: { role: 'owner', displayName: 'Mike', email: 'mike@example.com', joinedAt: 'TS' } },
      }),
    );
    expect(seed).toHaveBeenCalledWith('g-new');
  });

  it('does not seed categories when the group write fails', async () => {
    addDoc.mockRejectedValue(new Error('denied'));
    await expect(createGroup(user, { name: 'Trip', currency: 'AUD' })).rejects.toThrow('denied');
    expect(seed).not.toHaveBeenCalled();
  });
});
