import { describe, it, expect } from 'vitest';
import { Bus, Clapperboard, HeartPulse, House, Package, ShoppingBasket, UtensilsCrossed, Zap } from 'lucide-react';
import { iconForCategory } from './categoryIcons';

describe('iconForCategory', () => {
  it.each([
    ['Groceries', ShoppingBasket], ['Dining', UtensilsCrossed], ['Transport', Bus],
    ['Utilities', Zap], ['Household', House], ['Entertainment', Clapperboard],
    ['Health', HeartPulse], ['Other', Package],
  ])('maps %s', (name, icon) => {
    expect(iconForCategory(name)).toBe(icon);
  });

  it('ignores case and surrounding spaces', () => {
    expect(iconForCategory('  groceries ')).toBe(ShoppingBasket);
  });

  it('returns null for a custom category', () => {
    expect(iconForCategory('Pets')).toBeNull();
    expect(iconForCategory('')).toBeNull();
  });
});
