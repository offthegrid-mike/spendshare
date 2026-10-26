import { paths } from './paths';

/** How the app shell treats a route: a main section, or a secondary page with a back link. */
export type RouteInfo =
  | { kind: 'primary'; monthScoped: boolean }
  | { kind: 'secondary'; title: string; back: string };

export interface SearchReturnState {
  returnToSearch: true;
}

export function isSearchReturnState(state: unknown): state is SearchReturnState {
  return typeof state === 'object' && state !== null && 'returnToSearch' in state && state.returnToSearch === true;
}

const SECONDARY: Record<string, { title: string; back: string }> = {
  [paths.search]: { title: 'Search', back: paths.spend },
  [paths.categories]: { title: 'Categories', back: paths.more },
  [paths.tags]: { title: 'Tags', back: paths.more },
  [paths.groupInvites]: { title: 'Invite', back: paths.more },
  [paths.groupSettings]: { title: 'Group settings', back: paths.more },
  [paths.newExpense]: { title: 'New expense', back: paths.spend },
};

const MONTH_SCOPED = new Set([paths.spend, paths.summary, paths.income]);

const EDIT_EXPENSE_PATH = /^\/spend\/expense\/[^/]+\/edit$/;
const REFUND_EXPENSE_PATH = /^\/spend\/expense\/[^/]+\/refund$/;
const TAG_PATH = /^\/spend\/tags\/([^/]+)$/;

export function routeInfo(pathname: string): RouteInfo {
  const secondary = SECONDARY[pathname];
  if (secondary) return { kind: 'secondary', ...secondary };
  if (isEditExpensePath(pathname)) return { kind: 'secondary', title: 'Edit expense', back: paths.spend };
  if (isRefundExpensePath(pathname)) return { kind: 'secondary', title: 'Refund', back: paths.spend };
  const tag = TAG_PATH.exec(pathname);
  if (tag) return { kind: 'secondary', title: safeDecode(tag[1]), back: paths.tags };
  return { kind: 'primary', monthScoped: MONTH_SCOPED.has(pathname) };
}

/** An existing expense being edited. */
export function isEditExpensePath(pathname: string): boolean {
  return EDIT_EXPENSE_PATH.test(pathname);
}

/** A path segment decoded, or as it is when it isn't valid encoding (a hand-typed %E0). */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The page making a new refund of an expense. */
export function isRefundExpensePath(pathname: string): boolean {
  return REFUND_EXPENSE_PATH.test(pathname);
}

export function isExpenseEditorPath(pathname: string): boolean {
  return pathname.startsWith('/spend/expense/');
}
