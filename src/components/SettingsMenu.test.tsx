import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

function renderMenu() {
  return render(
    <MemoryRouter>
      <SettingsMenu />
      <p>Outside</p>
      <button type="button">Next control</button>
    </MemoryRouter>,
  );
}

const gear = () => screen.getByRole('button', { name: 'Settings menu' });

describe('SettingsMenu', () => {
  it('is closed until the gear is clicked', async () => {
    renderMenu();
    expect(gear()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(gear());
    expect(gear()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('lists the manage links, appearance and sign out', async () => {
    renderMenu();
    await userEvent.click(gear());
    expect(screen.getByRole('menuitem', { name: 'Categories' })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('menuitem', { name: 'Invite' })).toHaveAttribute('href', '/group/invites');
    expect(screen.getByRole('menuitem', { name: 'Group settings' })).toHaveAttribute('href', '/group/settings');
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('offers the theme as checkable menu items', async () => {
    renderMenu();
    await userEvent.click(gear());
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves focus to the first item when opened', async () => {
    renderMenu();
    await userEvent.click(gear());
    expect(screen.getByRole('menuitem', { name: 'Categories' })).toHaveFocus();
  });

  it('closes when focus tabs out of it', async () => {
    renderMenu();
    await userEvent.click(gear());
    screen.getByRole('menuitem', { name: 'Sign out' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the gear', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(gear()).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays open when changing the theme inside it', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves focus through every item, theme options included, with the arrow keys', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Invite' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
  });

  it('closes after choosing a link', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Categories' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signs out', async () => {
    renderMenu();
    await userEvent.click(gear());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});
