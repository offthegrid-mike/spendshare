import { describe, it, expect, vi } from 'vitest';

const { getDocs } = vi.hoisted(() => ({ getDocs: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  getDocs,
  query: (...args: unknown[]) => args,
  orderBy: () => 'orderBy',
  onSnapshot: vi.fn(),
}));
vi.mock('../lib/converters', () => ({ categoriesCol: (gid: string) => `cats:${gid}` }));

import { fetchActiveCategories } from './useCategories';

describe('fetchActiveCategories', () => {
  it('returns the active categories in order', async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: 'b', data: () => ({ name: 'Fuel', order: 1, archived: false }) },
        { id: 'x', data: () => ({ name: 'Old', order: 0, archived: true }) },
        { id: 'a', data: () => ({ name: 'Groceries', order: 0, archived: false }) },
      ],
    });
    const cats = await fetchActiveCategories('g2');
    expect(cats.map((c) => c.id)).toEqual(['a', 'b']);
    expect(getDocs).toHaveBeenCalledWith(['cats:g2', 'orderBy']);
  });
});
