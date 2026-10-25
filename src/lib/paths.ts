/** Every SpendShare screen lives under /spend, the Work tracker under /work; '/' is the Home screen. */
export const paths = {
  home: '/',
  spend: '/spend',
  summary: '/spend/summary',
  income: '/spend/income',
  search: '/spend/search',
  more: '/spend/more',
  newExpense: '/spend/expense/new',
  editExpense: (id: string): string => `/spend/expense/${id}/edit`,
  refundExpense: (id: string): string => `/spend/expense/${id}/refund`,
  categories: '/spend/categories',
  groupSettings: '/spend/group/settings',
  groupInvites: '/spend/group/invites',
  work: '/work',
  workMonth: '/work/month',
  workYear: '/work/year',
  workMore: '/work/more',
};

// The pre-/spend URLs, kept so old bookmarks and shared links still land.
const LEGACY_STATIC: Record<string, string> = {
  '/summary': paths.summary,
  '/income': paths.income,
  '/search': paths.search,
  '/more': paths.more,
  '/categories': paths.categories,
  '/group/settings': paths.groupSettings,
  '/group/invites': paths.groupInvites,
  '/expense/new': paths.newExpense,
};

const LEGACY_EDIT = /^\/expense\/([^/]+)\/edit$/;

/** The /spend twin of an old path, or null when the path isn't a legacy one. */
export function legacyTarget(pathname: string): string | null {
  const fixed = LEGACY_STATIC[pathname];
  if (fixed) return fixed;
  const edit = LEGACY_EDIT.exec(pathname);
  return edit ? paths.editExpense(edit[1]) : null;
}
