import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from 'firebase/auth';

const { addDoc, seed } = vi.hoisted(() => ({ addDoc: vi.fn(), seed: vi.fn() }));
vi.mock('firebase/firestore', () => ({ addDoc, serverTimestamp: () => 'TS' }));
vi.mock('../converters', () => ({ groupsCol: 'groupsCol' }));
vi.mock('../seedCategories', () => ({ seedDefaultCategories: seed }));

import { createTrip, TRAVEL_CATEGORIES } from './createTrip';

const user = { uid: 'alex', displayName: 'Alex', email: 'Alex@Example.com' } as unknown as User;

beforeEach(() => {
  addDoc.mockReset().mockResolvedValue({ id: 'trip-1' });
  seed.mockReset().mockResolvedValue(undefined);
});

describe('createTrip', () => {
  it('writes an owner-only trip group with its dates and home currency, and returns the id', async () => {
    const id = await createTrip(user, { name: ' Japan 2027 ', currency: 'AUD', startDate: '2027-05-10', endDate: '2027-05-20' });
    expect(id).toBe('trip-1');
    expect(addDoc).toHaveBeenCalledWith(
      'groupsCol',
      expect.objectContaining({
        name: 'Japan 2027',
        currency: 'AUD',
        kind: 'trip',
        trip: { startDate: '2027-05-10', endDate: '2027-05-20' },
        ownerUid: 'alex',
        memberUids: ['alex'],
        members: { alex: { role: 'owner', displayName: 'Alex', email: 'alex@example.com', joinedAt: 'TS' } },
      }),
    );
  });

  it('seeds travel categories instead of household ones', async () => {
    await createTrip(user, { name: 'Japan', currency: 'AUD', startDate: '2027-05-10', endDate: '2027-05-20' });
    expect(seed).toHaveBeenCalledWith('trip-1', TRAVEL_CATEGORIES);
    expect(TRAVEL_CATEGORIES).toEqual(['Accommodation', 'Transport', 'Food', 'Activities', 'Shopping', 'Fees', 'Other']);
  });

  it('refuses invalid input before writing anything', async () => {
    await expect(createTrip(user, { name: 'Japan', currency: 'AUD', startDate: '2027-05-10', endDate: '2027-05-01' }))
      .rejects.toThrow('The last day can’t be before the first.');
    expect(addDoc).not.toHaveBeenCalled();
  });
});
