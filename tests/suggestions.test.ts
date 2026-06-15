import { describe, it, expect } from 'vitest';
import { computeSuggestionsDelta } from '../src/lib/suggestions';
import type { SuggestionEntry } from '../src/types/models';

const milk: SuggestionEntry = { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 3 };
const bread: SuggestionEntry = { name: 'Bread', categoryId: 'cat1', category: 'Groceries', count: 1 };

describe('computeSuggestionsDelta', () => {
  it('adds new entries at count 1 on create (empty current)', () => {
    const result = computeSuggestionsDelta([], [], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result).toEqual([
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 1 },
    ]);
  });

  it('increments count for an existing entry', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result[0].count).toBe(4);
  });

  it('decrements count for removed entries', () => {
    const result = computeSuggestionsDelta([milk, bread], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ], []);
    const m = result.find((e) => e.name === 'Milk');
    expect(m?.count).toBe(2);
  });

  it('removes entries when count reaches zero', () => {
    const result = computeSuggestionsDelta([bread], [
      { name: 'Bread', categoryId: 'cat1', category: 'Groceries' },
    ], []);
    expect(result.find((e) => e.name === 'Bread')).toBeUndefined();
  });

  it('is case-insensitive for deduplication; most-recent casing wins', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(4);
    expect(result[0].name).toBe('milk');
  });

  it('NFC-normalises before dedup: composed vs decomposed é merge', () => {
    const composed = 'café';    // café — é as single code point
    const decomposed = 'café'; // café — e + combining acute
    const existing: SuggestionEntry = {
      name: composed, categoryId: 'cat1', category: 'Dining', count: 1,
    };
    const result = computeSuggestionsDelta([existing], [], [
      { name: decomposed, categoryId: 'cat1', category: 'Dining' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('treats same name with different categoryId as distinct entries', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'Milk', categoryId: 'cat2', category: 'Dairy' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('returns entries sorted by count descending', () => {
    const result = computeSuggestionsDelta([milk, bread], [], [
      { name: 'Bread', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result[0].name).toBe('Milk');
    expect(result[1].name).toBe('Bread');
  });

  it('handles simultaneous remove-old and add-new on update', () => {
    const result = computeSuggestionsDelta([milk], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ], [
      { name: 'Eggs', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result.find((e) => e.name === 'Milk')?.count).toBe(2);
    expect(result.find((e) => e.name === 'Eggs')?.count).toBe(1);
  });
});
