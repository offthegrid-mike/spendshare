import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import { makeGroup } from '../test/fixtures';

vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthControl', () => ({ default: () => <div data-testid="month-control" /> }));
vi.mock('./SettingsMenu', () => ({ default: () => <button type="button">Settings menu</button> }));

function Location() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderBar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar groups={[makeGroup('g1', 'Home')]} currentUid="mike" />
      <Routes>
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

const search = () => screen.getByRole('searchbox', { name: 'Search items' });

describe('TopBar', () => {
  it('links to the three sections and marks the current one', () => {
    renderBar('/summary');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Income' })).toHaveAttribute('href', '/income');
  });

  it('has an Add expense link to the editor page', () => {
    renderBar();
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/expense/new');
  });

  it('has no month control (the desktop month rail replaces it)', () => {
    renderBar('/income');
    expect(screen.queryByTestId('month-control')).toBeNull();
  });

  it('navigates to /search?q= on Enter', async () => {
    renderBar();
    await userEvent.type(search(), 'milk bread{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=milk%20bread');
  });

  it('navigates to /search with an empty query', async () => {
    renderBar();
    await userEvent.type(search(), '   {Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/search$/);
  });

  it('mirrors the query when on /search', () => {
    renderBar('/search?q=eggs');
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
