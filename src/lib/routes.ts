/** How the app shell treats a route: a main section, or a secondary page with a back link. */
export type RouteInfo =
  | { kind: 'primary'; monthScoped: boolean }
  | { kind: 'secondary'; title: string; back: string };

const SECONDARY: Record<string, { title: string; back: string }> = {
  '/search': { title: 'Search', back: '/' },
  '/categories': { title: 'Categories', back: '/more' },
  '/group/invites': { title: 'Invite', back: '/more' },
  '/group/settings': { title: 'Group settings', back: '/more' },
  '/expense/new': { title: 'New expense', back: '/' },
};

const MONTH_SCOPED = new Set(['/', '/summary', '/income']);

export function routeInfo(pathname: string): RouteInfo {
  const secondary = SECONDARY[pathname];
  if (secondary) return { kind: 'secondary', ...secondary };
  if (/^\/expense\/[^/]+\/edit$/.test(pathname)) return { kind: 'secondary', title: 'Edit expense', back: '/' };
  return { kind: 'primary', monthScoped: MONTH_SCOPED.has(pathname) };
}

export function isExpenseEditorPath(pathname: string): boolean {
  return pathname.startsWith('/expense/');
}
