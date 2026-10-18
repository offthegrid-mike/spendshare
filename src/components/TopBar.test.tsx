import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import type { User } from 'firebase/auth';
import { makeGroup } from '../test/fixtures';
import { paths } from '../lib/paths';

const mockUser = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthControl', () => ({ default: () => <div data-testid="month-control" /> }));
vi.mock('./SettingsMenu', () => ({ default: () => <button type="button">Settings menu</button> }));

function Location() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderBar(path = paths.spend, showHome?: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar groups={[makeGroup('g1', 'Home')]} user={mockUser} showHome={showHome} />
      <Routes>
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

const search = () => screen.getByRole('searchbox', { name: 'Search items' });

describe('TopBar', () => {
  it('links to the three sections and marks the current one', () => {
    renderBar(paths.summary);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', paths.spend);
    expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Income' })).toHaveAttribute('href', paths.income);
  });

  it('has an Add expense link to the editor page', () => {
    renderBar();
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', paths.newExpense);
  });

  it('links to Home when showHome is on', () => {
    renderBar(paths.spend, true);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', paths.home);
  });

  it('has no Home link without showHome', () => {
    renderBar();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });

  it('has no month control (the desktop month rail replaces it)', () => {
    renderBar(paths.income);
    expect(screen.queryByTestId('month-control')).toBeNull();
  });

  it('navigates to /spend/search?q= on Enter', async () => {
    renderBar();
    await userEvent.type(search(), 'milk bread{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent(`${paths.search}?q=milk%20bread`);
  });

  it('navigates to /spend/search with an empty query', async () => {
    renderBar();
    await userEvent.type(search(), '   {Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent(new RegExp(`^${paths.search}$`));
  });

  it('mirrors the query when on /spend/search', () => {
    renderBar(`${paths.search}?q=eggs`);
    expect(search()).toHaveValue('eggs');
  });

  it('focuses the search field with Ctrl+K', async () => {
    renderBar();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(search()).toHaveFocus();
  });

  it('focuses the search field with Cmd+K', async () => {
    renderBar();
    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(search()).toHaveFocus();
  });
});
