import { describe, it, expect } from 'vitest';
import { filterAndSortCategories } from '../src/lib/categoryHelpers';
import type { CategoryDoc } from '../src/types/models';

// Helpers to build test fixtures
const cat = (id: string, name: string, order: number, archived = false): CategoryDoc => ({
  id,
  name,
  order,
  archived,
});

describe('filterAndSortCategories', () => {
  it('returns empty all and active arrays for empty input', () => {
    const result = filterAndSortCategories([]);
    expect(result.all).toEqual([]);
    expect(result.active).toEqual([]);
  });

  it('sorts all categories by order ascending', () => {
    const docs: CategoryDoc[] = [
      cat('c', 'Transport', 2),
      cat('a', 'Groceries', 0),
      cat('b', 'Dining', 1),
    ];
    const { all } = filterAndSortCategories(docs);
    expect(all.map((c) => c.order)).toEqual([0, 1, 2]);
    expect(all.map((c) => c.name)).toEqual(['Groceries', 'Dining', 'Transport']);
  });

  it('active filters out archived categories and keeps sort order', () => {
    const docs: CategoryDoc[] = [
      cat('a', 'Groceries', 0, false),
      cat('b', 'Entertainment', 1, true), // archived
      cat('c', 'Health', 2, false),
      cat('d', 'Other', 3, true), // archived
    ];
    const { active } = filterAndSortCategories(docs);
    expect(active).toHaveLength(2);
    expect(active.map((c) => c.name)).toEqual(['Groceries', 'Health']);
  });

  it('all includes both archived and non-archived categories', () => {
    const docs: CategoryDoc[] = [
      cat('a', 'Groceries', 0, false),
      cat('b', 'Entertainment', 1, true),
    ];
    const { all } = filterAndSortCategories(docs);
    expect(all).toHaveLength(2);
    expect(all.find((c) => c.archived)).toBeTruthy();
  });

  it('active includes all categories when none are archived', () => {
    const docs: CategoryDoc[] = [
      cat('a', 'Groceries', 0),
      cat('b', 'Dining', 1),
      cat('c', 'Transport', 2),
    ];
    const { all, active } = filterAndSortCategories(docs);
    expect(active).toHaveLength(3);
    expect(active).toEqual(all);
  });

  it('active is empty when all categories are archived', () => {
    const docs: CategoryDoc[] = [
      cat('a', 'Groceries', 0, true),
      cat('b', 'Dining', 1, true),
    ];
    const { all, active } = filterAndSortCategories(docs);
    expect(all).toHaveLength(2);
    expect(active).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const docs: CategoryDoc[] = [
      cat('b', 'Dining', 1),
      cat('a', 'Groceries', 0),
    ];
    const original = [...docs];
    filterAndSortCategories(docs);
    expect(docs[0].id).toBe(original[0].id);
    expect(docs[1].id).toBe(original[1].id);
  });
});
