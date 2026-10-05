import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import HouseholdHeader from './HouseholdHeader';
import type { User } from 'firebase/auth';
import { makeGroup } from '../test/fixtures';

const mockUser = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthControl', () => ({ default: () => <div data-testid="month-control" /> }));

function renderHeader(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HouseholdHeader groups={[makeGroup('g1', 'Home')]} user={mockUser} startMonth={null} />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

describe('HouseholdHeader', () => {
  it.each(['/', '/summary', '/income'])('shows the household cluster and month control on %s', (path) => {
    renderHeader(path);
    expect(screen.getByTestId('group-switcher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
    expect(screen.getByTestId('month-control')).toBeInTheDocument();
  });

  it('shows the household cluster without a month control on /more', () => {
    renderHeader('/more');
    expect(screen.getByTestId('group-switcher')).toBeInTheDocument();
    expect(screen.queryByTestId('month-control')).toBeNull();
  });

  it.each([
    ['/search', 'Search', '/'],
    ['/categories', 'Categories', '/more'],
    ['/group/invites', 'Invite', '/more'],
    ['/group/settings', 'Group settings', '/more'],
    ['/expense/new', 'New expense', '/'],
    ['/expense/abc123/edit', 'Edit expense', '/'],
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
          { pathname: '/search', state: { query: 'coles', scrollY: 240 } },
          { pathname: '/expense/abc123/edit', state: { returnToSearch: true } },
        ]}
        initialIndex={1}
      >
        <HouseholdHeader groups={[makeGroup('g1', 'Home')]} user={mockUser} startMonth={null} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/search');
  });

  it('has no sign out button', () => {
    renderHeader('/');
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
  });

  it('sits on a solid canvas and gains its bottom border only once the page scrolls', () => {
    renderHeader('/');
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
