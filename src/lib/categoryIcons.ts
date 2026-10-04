import {
  Bus, Clapperboard, HeartPulse, House, Package, ShoppingBasket, UtensilsCrossed, Zap,
  type LucideIcon,
} from 'lucide-react';

// The seeded default categories (lib/seedCategories.ts). Custom categories
// get no icon; their tile shows the first letter instead.
const ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingBasket,
  dining: UtensilsCrossed,
  transport: Bus,
  utilities: Zap,
  household: House,
  entertainment: Clapperboard,
  health: HeartPulse,
  other: Package,
};

export function iconForCategory(name: string): LucideIcon | null {
  return ICONS[name.trim().toLowerCase()] ?? null;
}
