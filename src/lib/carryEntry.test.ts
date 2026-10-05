import { describe, it, expect } from 'vitest';
import { carryEntry } from './carryEntry';
import type { CategoryDoc } from '../types/models';
import type { ExpenseDraftValues } from '../hooks/useExpenseDraft';

const cat = (id: string, name: string, order = 0, archived = false): CategoryDoc =>
  ({ id, name, order, archived }) as CategoryDoc;

const home = [cat('h-groc', 'Groceries', 0), cat('h-house', 'Household', 1), cat('h-old', 'Old', 2, true)];
const trip = [cat('t-groc', ' groceries ', 0), cat('t-fuel', 'Fuel', 1)];

function entry(items: ExpenseDraftValues['items']): ExpenseDraftValues {
  return {
    date: '2026-10-04',
    shopName: 'Coles Hobart',
    payerUid: 'priya',
    giftCardAmount: '5.00',
    applyDiscount: true,
    discountPercent: '2',
    items,
  };
}

const item = (name: string, categoryId: string) => ({
  name, categoryId, amount: '18.00', quantity: '2', shared: false, remark: 'note',
});

describe('carryEntry', () => {
  it('maps categories by name, ignoring case and surrounding spaces', () => {
    const { values, flagged } = carryEntry(entry([item('Snacks', 'h-groc')]), home, trip, 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: 't-groc', categoryUnconfirmed: false });
    expect(flagged).toBe(0);
  });

  it('falls back to the first target category and flags items with no match', () => {
    const { values, flagged } = carryEntry(entry([item('Firewood', 'h-house'), item('Snacks', 'h-groc')]), home, trip, 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: 't-groc', categoryUnconfirmed: true });
    expect(values.items[1]).toMatchObject({ categoryId: 't-groc', categoryUnconfirmed: false });
    expect(flagged).toBe(1);
  });

  it('flags an item whose source category is unknown', () => {
    const { values, flagged } = carryEntry(entry([item('Mystery', 'deleted-cat')]), home, trip, 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: 't-groc', categoryUnconfirmed: true });
    expect(flagged).toBe(1);
  });

  it('matches an archived source category by name', () => {
    const { values } = carryEntry(entry([item('Thing', 'h-old')]), home, [cat('t-old', 'Old')], 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: 't-old', categoryUnconfirmed: false });
  });

  it('leaves an item with no category uncategorised and unflagged', () => {
    const { values, flagged } = carryEntry(entry([item('Loose', '')]), home, trip, 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: '', categoryUnconfirmed: false });
    expect(flagged).toBe(0);
  });

  it('flags every categorised item when the target has no categories', () => {
    const { values, flagged } = carryEntry(entry([item('Snacks', 'h-groc')]), home, [], 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: '', categoryUnconfirmed: true });
    expect(flagged).toBe(1);
  });

  it('keeps an earlier flag through a later move', () => {
    const flaggedItem = { ...item('Snacks', 'h-groc'), categoryUnconfirmed: true };
    const { values, flagged } = carryEntry(entry([flaggedItem]), home, trip, 'mike');
    expect(values.items[0]).toMatchObject({ categoryId: 't-groc', categoryUnconfirmed: true });
    expect(flagged).toBe(1);
  });

  it('resets the payer to the current user and keeps every other field', () => {
    const source = entry([item('Snacks', 'h-groc')]);
    const { values } = carryEntry(source, home, trip, 'mike');
    expect(values).toMatchObject({
      date: '2026-10-04', shopName: 'Coles Hobart', payerUid: 'mike',
      giftCardAmount: '5.00', applyDiscount: true, discountPercent: '2',
    });
    expect(values.items[0]).toMatchObject({ name: 'Snacks', amount: '18.00', quantity: '2', shared: false, remark: 'note' });
  });

  it('does not mutate its input', () => {
    const source = entry([item('Snacks', 'h-groc')]);
    const snapshot = structuredClone(source);
    carryEntry(source, home, trip, 'mike');
    expect(source).toEqual(snapshot);
  });
});
