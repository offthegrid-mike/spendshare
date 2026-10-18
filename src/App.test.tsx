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
  expense: null as { id: string } | null,
}));
const flags = vi.hoisted(() => ({ work: false }));

vi.mock('./lib/features', () => ({
  get WORK_ENABLED() {
    return flags.work;
  },
  DARK_MODE_ENABLED: true,
}));

vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('./hooks/useGroups', () => ({ useGroups: () => ({ groups: state.groups, loading: false }) }));
vi.mock('./hooks/useGroup', () => ({ useGroup: () => ({ group: state.groups[0] ?? null }) }));
vi.mock('./hooks/useExpense', () => ({
  useExpense: () => ({ expense: state.expense, items: [], loading: false }),
}));
vi.mock('./hooks/useIncome', () => ({ useIncome: () => ({ income: null, loading: false }) }));

vi.mock('./components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});
vi.mock('./features/auth/SignIn', () => ({ default: () => <div data-testid="sign-in" /> }));
vi.mock('./features/groups/CreateGroup', () => ({ default: () => <div data-testid="create-group" /> }));
vi.mock('./features/invites/PendingInvites', () => ({ default: () => <div data-testid="pending-invites" /> }));
vi.mock('./features/groups/GroupSettings', () => ({ default: () => <div data-testid="group-settings" /> }));
vi.mock('./features/invites/SendInvite', () => ({ default: () => <div data-testid="send-invite" /> }));
vi.mock('./features/categories/CategoryManager', () => ({ default: () => <div data-testid="category-manager" /> }));
vi.mock('./features/expenses/ExpenseEditor', () => ({
  default: ({ expense }: { expense?: { id: string } }) => (
    <div data-testid="expense-editor" data-expense={expense?.id ?? ''} />
  ),
}));
vi.mock('./features/expenses/ExpenseList', () => ({ default: () => <div data-testid="expense-list" /> }));
vi.mock('./features/income/IncomeEditor', () => ({ default: () => <div data-testid="income-editor" /> }));
vi.mock('./features/summary/Summary', () => ({ default: () => <div data-testid="summary" /> }));
vi.mock('./features/more/MoreScreen', () => ({ default: () => <div data-testid="more-screen" /> }));
vi.mock('./features/search/SearchScreen', () => ({ default: () => <div data-testid="search-screen" /> }));
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
  ];

  it.each(screens)('serves $name at $path without redirecting', ({ path, screen: testId, editing }) => {
    state.expense = { id: 'x' };
    renderApp(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(location()).toBe(path);
    if (editing !== undefined) expect(screen.getByTestId(testId)).toHaveAttribute('data-expense', editing);
  });
});

describe('App gates', () => {
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
});
