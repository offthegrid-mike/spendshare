import { paths } from '../../lib/paths';

/** Where the back link goes: the trip list goes Home, a trip goes to the list, a trip's settings to the trip. */
export function backTarget(pathname: string): { to: string; label: string } {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['travel', id?, 'settings'?]
  if (parts.length <= 1) return { to: paths.home, label: 'Home' };
  if (parts.length === 2) return { to: paths.travel, label: 'Trips' };
  return { to: paths.trip(parts[1]), label: 'Trip' };
}
