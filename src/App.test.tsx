import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from './App';
import { useUIStore } from './stores/uiStore';
import { paths } from './lib/paths';
import { makeGroup } from './test/fixtures';

const state = vi.hoisted(() => ({
  user: null as { uid: string; email: string } | null,
  groups: [] as unknown[],
  expense: null as { id: string; kind?: string; refundOf?: string } | null,
  refunds: [] as { id: string; total: number }[],
  access: 'allowed' as string,
  groupsUid: undefined as string | undefined,
}));
const flags = vi.hoisted(() => ({ work: false }));

vi.mock('./lib/features', () => ({
  get WORK_ENABLED() {
    return flags.work;
  },
  DARK_MODE_ENABLED: true,
}));

vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('./hooks/useAllowlist', () => ({ useAllowlist: () => state.access }));
vi.mock('./hooks/useGroups', () => ({
  useGroups: (uid: string | undefined) => {
    state.groupsUid = uid;
    return { groups: state.groups, loading: false };
  },
}));
vi.mock('./hooks/useGroup', () => ({ useGroup: () => ({ group: state.groups[0] ?? null }) }));
vi.mock('./hooks/useExpense', () => ({
  useExpense: () => ({ expense: state.expense, items: [], loading: false }),
}));
vi.mock('./hooks/useIncome', () => ({ useIncome: () => ({ income: null, loading: false }) }));
vi.mock('./hooks/useWorkSettings', async () => {
  const { DEFAULT_WORK_SETTINGS } = await import('./lib/work/workSettings');
  return { useWorkSettings: () => ({ settings: DEFAULT_WORK_SETTINGS, loading: false, loaded: true }) };
});

vi.mock('./components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});
vi.mock('./features/auth/SignIn', () => ({ default: () => <div data-testid="sign-in" /> }));
vi.mock('./features/auth/NotAllowed', () => ({
  default: ({ status }: { status: string }) => <div data-testid="not-allowed" data-status={status} />,
}));
vi.mock('./features/groups/CreateGroup', () => ({ default: () => <div data-testid="create-group" /> }));
vi.mock('./features/invites/PendingInvites', () => ({ default: () => <div data-testid="pending-invites" /> }));
vi.mock('./features/groups/GroupSettings', () => ({ default: () => <div data-testid="group-settings" /> }));
vi.mock('./features/invites/SendInvite', () => ({ default: () => <div data-testid="send-invite" /> }));
vi.mock('./features/categories/CategoryManager', () => ({ default: () => <div data-testid="category-manager" /> }));
vi.mock('./features/expenses/ExpenseEditor', () => ({
  default: ({ expense, refunded }: { expense?: { id: string }; refunded?: number }) => (
    <div data-testid="expense-editor" data-expense={expense?.id ?? ''} data-refunded={refunded ?? ''} />
  ),
}));
vi.mock('./hooks/useRefunds', () => ({
  useRefunds: () => ({ refunds: state.refunds, loading: false, error: false }),
}));
vi.mock('./features/expenses/RefundRoute', () => ({
  default: ({ originalId, refund }: { originalId: string; refund?: { id: string } }) => (
    <div data-testid="refund-route" data-original={originalId} data-expense={refund?.id ?? ''} />
  ),
}));
vi.mock('./features/expenses/ExpenseList', () => ({ default: () => <div data-testid="expense-list" /> }));
vi.mock('./features/income/IncomeEditor', () => ({ default: () => <div data-testid="income-editor" /> }));
vi.mock('./features/summary/Summary', () => ({ default: () => <div data-testid="summary" /> }));
vi.mock('./features/more/MoreScreen', () => ({ default: () => <div data-testid="more-screen" /> }));
vi.mock('./features/search/SearchScreen', () => ({ default: () => <div data-testid="search-screen" /> }));
vi.mock('./features/work/TodayTab', () => ({ default: () => <div data-testid="work-today" /> }));
vi.mock('./features/work/MonthTab', () => ({ default: () => <div data-testid="work-month" /> }));
vi.mock('./features/work/YearTab', () => ({ default: () => <div data-testid="work-year" /> }));
vi.mock('./features/work/WorkSettings', () => ({ default: () => <div data-testid="work-more" /> }));
vi.mock('./features/home/HomeScreen', () => ({
  default: ({ user, groups, group }: { user: { uid: string }; groups: unknown[]; group: { id: string } | null }) => (
    <div data-testid="home-screen" data-user={user.uid} data-groups={groups.length} data-group={group?.id ?? ''} />
  ),
}));

const mike = { uid: 'mike', email: 'mike@example.com' };
const home = makeGroup('g1', 'Home');

function Location() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="location">{pathname + search + hash}</output>;
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  flags.work = false;
  state.user = mike;
  state.groups = [home];
  state.expense = null;
  state.access = 'allowed';
  state.groupsUid = undefined;
  useUIStore.setState({ selectedGroupId: 'g1', pendingGroupId: null });
});

describe('App routes', () => {
  it('sends / to the expenses list while the work tracker is off', () => {
    flags.work = false;
    renderApp('/');
    expect(screen.getByTestId('expense-list')).toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(location()).toBe('/spend');
  });

  it('redirects the old /summary to /spend/summary', () => {
    renderApp('/summary');
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    expect(location()).toBe('/spend/summary');
  });

  it('redirects an old path with a trailing slash', () => {
    renderApp('/summary/');
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    expect(location()).toBe('/spend/summary');
  });

  it('keeps the query and hash when redirecting an old path', () => {
    renderApp('/search?q=milk%20bread#top');
    expect(screen.getByTestId('search-screen')).toBeInTheDocument();
    expect(location()).toBe('/spend/search?q=milk%20bread#top');
  });

  it('redirects an old edit-expense path with its id', () => {
    renderApp('/expense/abc123/edit');
    expect(location()).toBe('/spend/expense/abc123/edit');
  });

  it('sends an unknown path to the expenses list', () => {
    renderApp('/nope');
    expect(screen.getByTestId('expense-list')).toBeInTheDocument();
    expect(location()).toBe('/spend');
  });

  it.each([paths.work, paths.workMonth, paths.workYear, paths.workMore])(
    'sends %s to the expenses list while the work tracker is off',
    (path) => {
      renderApp(path);
      expect(screen.getByTestId('expense-list')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Work' })).toBeNull();
      expect(screen.queryByTestId('work-today')).toBeNull();
      expect(location()).toBe('/spend');
    },
  );
});

describe('App route table', () => {
  // The child routes in App.tsx are string literals and every link comes from `paths`,
  // so a typo in either one would still typecheck. Rendering each path pins them together.
  const screens = [
    { name: 'spend', path: paths.spend, screen: 'expense-list' },
    { name: 'summary', path: paths.summary, screen: 'summary' },
    { name: 'income', path: paths.income, screen: 'income-editor' },
    { name: 'search', path: paths.search, screen: 'search-screen' },
    { name: 'more', path: paths.more, screen: 'more-screen' },
    { name: 'categories', path: paths.categories, screen: 'category-manager' },
    { name: 'group settings', path: paths.groupSettings, screen: 'group-settings' },
    { name: 'group invites', path: paths.groupInvites, screen: 'send-invite' },
    { name: 'new expense', path: paths.newExpense, screen: 'expense-editor', editing: '' },
    { name: 'edit expense', path: paths.editExpense('x'), screen: 'expense-editor', editing: 'x' },
    { name: 'refund', path: paths.refundExpense('x'), screen: 'refund-route', editing: '' },
  ];

  it.each(screens)('serves $name at $path without redirecting', ({ path, screen: testId, editing }) => {
    state.expense = { id: 'x' };
    renderApp(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(location()).toBe(path);
    if (editing !== undefined) expect(screen.getByTestId(testId)).toHaveAttribute('data-expense', editing);
  });
});

describe('App refunds', () => {
  it("passes what has been refunded from a purchase to its editor", () => {
    state.expense = { id: 'e1' };
    state.refunds = [{ id: 'r1', total: 1500 }, { id: 'r2', total: 500 }];
    try {
      renderApp(paths.editExpense('e1'));
      expect(screen.getByTestId('expense-editor')).toHaveAttribute('data-refunded', '2000');
    } finally {
      state.refunds = [];
    }
  });

  it('edits an existing refund as a refund of its original', () => {
    state.expense = { id: 'r1', kind: 'refund', refundOf: 'e1' };
    renderApp(paths.editExpense('r1'));
    const route = screen.getByTestId('refund-route');
    expect(route).toHaveAttribute('data-original', 'e1');
    expect(route).toHaveAttribute('data-expense', 'r1');
    expect(screen.queryByTestId('expense-editor')).toBeNull();
  });
});

describe('App gates', () => {
  it('turns away a signed-in user who is not on the allowlist, without loading their groups', () => {
    state.access = 'denied';
    renderApp('/spend');
    expect(screen.getByTestId('not-allowed')).toHaveAttribute('data-status', 'denied');
    expect(screen.queryByTestId('expense-list')).toBeNull();
    expect(state.groupsUid).toBeUndefined();
  });

  it('asks a signed-in user with an unverified email to verify it', () => {
    state.access = 'unverified';
    renderApp('/spend');
    expect(screen.getByTestId('not-allowed')).toHaveAttribute('data-status', 'unverified');
  });

  it('shows the splash while the allowlist check is loading', () => {
    state.access = 'loading';
    renderApp('/spend');
    expect(screen.queryByTestId('not-allowed')).toBeNull();
    expect(screen.queryByTestId('expense-list')).toBeNull();
  });

  it('loads the groups of an allowed user', () => {
    renderApp('/spend');
    expect(state.groupsUid).toBe('mike');
    expect(screen.getByTestId('expense-list')).toBeInTheDocument();
  });

  it('shows the sign-in screen at a /spend path when signed out, without redirecting', () => {
    state.user = null;
    renderApp('/spend/summary');
    expect(screen.getByTestId('sign-in')).toBeInTheDocument();
    expect(location()).toBe('/spend/summary');
  });

  it('asks a signed-in user with no groups to create one, beside any pending invites', () => {
    state.groups = [];
    renderApp('/spend');
    expect(screen.getByTestId('create-group')).toBeInTheDocument();
    expect(screen.getByTestId('pending-invites')).toBeInTheDocument();
  });

  it('offers no way back to Home from the household gate while the work tracker is off', () => {
    state.groups = [];
    renderApp('/spend');
    expect(screen.getByTestId('create-group')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });

  it('applies the same gate to every /spend screen', () => {
    state.groups = [];
    renderApp('/spend/summary');
    expect(screen.getByTestId('create-group')).toBeInTheDocument();
    expect(screen.getByTestId('pending-invites')).toBeInTheDocument();
    expect(screen.queryByTestId('summary')).toBeNull();
  });
});

describe('App with the work tracker on', () => {
  beforeEach(() => {
    flags.work = true;
  });

  it('shows Home at / without redirecting', () => {
    renderApp('/');
    expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('expense-list')).toBeNull();
    expect(location()).toBe('/');
  });

  it('hands Home the user, the groups and the selected group', () => {
    renderApp('/');
    const homeScreen = screen.getByTestId('home-screen');
    expect(homeScreen).toHaveAttribute('data-user', 'mike');
    expect(homeScreen).toHaveAttribute('data-groups', '1');
    expect(homeScreen).toHaveAttribute('data-group', 'g1');
  });

  it('shows Home at / even with no groups', () => {
    state.groups = [];
    renderApp('/');
    expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('create-group')).toBeNull();
    expect(location()).toBe('/');
  });

  it('still asks for a household at /spend when there are no groups', () => {
    state.groups = [];
    renderApp('/spend');
    expect(screen.getByTestId('create-group')).toBeInTheDocument();
    expect(screen.getByTestId('pending-invites')).toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).toBeNull();
  });

  it('offers a way back to Home above the household gate', () => {
    state.groups = [];
    renderApp('/spend');
    const back = screen.getByRole('link', { name: 'Home' });
    expect(back).toHaveAttribute('href', '/');
    const follows = (id: string) =>
      Boolean(back.compareDocumentPosition(screen.getByTestId(id)) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows('pending-invites')).toBe(true);
    expect(follows('create-group')).toBe(true);
  });

  it('goes to Home from the household gate', async () => {
    state.groups = [];
    renderApp('/spend');
    await userEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(location()).toBe('/');
    expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('create-group')).toBeNull();
  });

  it('keeps /spend on the expenses list', () => {
    renderApp('/spend');
    expect(screen.getByTestId('expense-list')).toBeInTheDocument();
    expect(location()).toBe('/spend');
  });

  it('shows the sign-in screen at / when signed out', () => {
    state.user = null;
    renderApp('/');
    expect(screen.getByTestId('sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).toBeNull();
  });

  it('serves the Work layout and the Today tab at /work without redirecting', () => {
    renderApp(paths.work);
    expect(screen.getByRole('navigation', { name: 'Work' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    expect(screen.getByTestId('work-today')).toBeInTheDocument();
    expect(location()).toBe('/work');
  });

  it('serves the Month, Year and More tabs inside the Work layout', () => {
    let { unmount } = renderApp(paths.workMonth);
    expect(screen.getByTestId('work-month')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Work' })).toBeInTheDocument();
    expect(location()).toBe('/work/month');
    unmount();

    ({ unmount } = renderApp(paths.workYear));
    expect(screen.getByTestId('work-year')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Work' })).toBeInTheDocument();
    expect(location()).toBe('/work/year');
    unmount();

    renderApp(paths.workMore);
    expect(screen.getByTestId('work-more')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Work' })).toBeInTheDocument();
    expect(location()).toBe('/work/more');
  });

  it('works for a user with no groups', () => {
    state.groups = [];
    renderApp(paths.work);
    expect(screen.getByTestId('work-today')).toBeInTheDocument();
    expect(screen.queryByTestId('create-group')).toBeNull();
  });

  it('shows the sign-in screen at /work when signed out', () => {
    state.user = null;
    renderApp(paths.work);
    expect(screen.getByTestId('sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('work-today')).toBeNull();
  });
});
