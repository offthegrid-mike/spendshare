import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import HouseholdHeader from './HouseholdHeader';
import type { User } from 'firebase/auth';
import { makeGroup } from '../test/fixtures';
import { paths } from '../lib/paths';
import { useUIStore } from '../stores/uiStore';

const mockUser = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthControl', () => ({ default: () => <div data-testid="month-control" /> }));

function renderHeader(path: string, showHome?: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HouseholdHeader groups={[makeGroup('g1', 'Home')]} user={mockUser} startMonth={null} showHome={showHome} />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

describe('HouseholdHeader', () => {
  it.each([paths.spend, paths.summary, paths.income])('shows the household cluster and month control on %s', (path) => {
    renderHeader(path);
    expect(screen.getByTestId('group-switcher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', paths.search);
    expect(screen.getByTestId('month-control')).toBeInTheDocument();
  });

  it('shows the household cluster without a month control on /spend/more', () => {
    renderHeader(paths.more);
    expect(screen.getByTestId('group-switcher')).toBeInTheDocument();
    expect(screen.queryByTestId('month-control')).toBeNull();
  });

  it.each([
    [paths.search, 'Search', paths.spend],
    [paths.categories, 'Categories', paths.more],
    [paths.groupInvites, 'Invite', paths.more],
    [paths.groupSettings, 'Group settings', paths.more],
    [paths.newExpense, 'New expense', paths.spend],
    [paths.editExpense('abc123'), 'Edit expense', paths.spend],
  ])('secondary route %s shows title "%s" and a back link to %s', (path, title, back) => {
    renderHeader(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', back);
    expect(screen.queryByTestId('group-switcher')).toBeNull();
    expect(screen.queryByTestId('month-control')).toBeNull();
  });

  it('returns an expense opened from search to the saved search history entry', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: paths.search, state: { query: 'coles', scrollY: 240 } },
          { pathname: paths.editExpense('abc123'), state: { returnToSearch: true } },
        ]}
        initialIndex={1}
      >
        <HouseholdHeader groups={[makeGroup('g1', 'Home')]} user={mockUser} startMonth={null} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));

    expect(screen.getByTestId('location')).toHaveTextContent(paths.search);
  });

  it('links to Home on a primary route when showHome is on', () => {
    renderHeader(paths.spend, true);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', paths.home);
  });

  it('gives the Home link a tap target of at least 40px without moving it', () => {
    renderHeader(paths.spend, true);
    // 20px of text plus 10px of padding above and below, taken back out of the layout by the negative margin.
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('py-2.5', '-my-2.5');
  });

  it('has no Home link without showHome', () => {
    renderHeader(paths.spend);
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });

  it('has no Home link on a secondary route even with showHome', () => {
    renderHeader(paths.categories, true);
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });

  it('has no sign out button', () => {
    renderHeader(paths.spend);
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
  });

  it('sits on a solid canvas and gains its bottom border only once the page scrolls', () => {
    renderHeader(paths.spend);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-canvas');
    expect(header.className).not.toContain('backdrop-blur');
    expect(header.className).not.toContain('border-line');

    act(() => {
      window.scrollY = 24;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.className).toContain('border-line');

    act(() => {
      window.scrollY = 0;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.className).not.toContain('border-line');
  });
});

describe('HouseholdHeader page title', () => {
  it("uses the page's own title when it sets one, such as Edit refund", () => {
    useUIStore.setState({ pageTitle: 'Edit refund' });
    try {
      renderHeader(paths.editExpense('r1'));
      expect(screen.getByRole('heading', { name: 'Edit refund' })).toBeInTheDocument();
    } finally {
      useUIStore.setState({ pageTitle: null });
    }
  });

  it('falls back to the route title', () => {
    renderHeader(paths.editExpense('e1'));
    expect(screen.getByRole('heading', { name: 'Edit expense' })).toBeInTheDocument();
  });
});
