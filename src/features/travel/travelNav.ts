import { paths } from '../../lib/paths';

/** Where the back link goes: the trip list goes Home, a trip to the list, its settings and expenses to the trip, editing an expense to the expense. */
export function backTarget(pathname: string): { to: string; label: string } {
  // ['travel', tripId?, 'settings' | 'expense'?, expenseId | 'new'?, 'edit'?]
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length <= 1) return { to: paths.home, label: 'Home' };
  if (parts.length === 2) return { to: paths.travel, label: 'Trips' };
  if (parts[2] === 'expense' && parts[4] === 'edit') return { to: paths.tripExpense(parts[1], parts[3]), label: 'Expense' };
  return { to: paths.trip(parts[1]), label: 'Trip' };
}
