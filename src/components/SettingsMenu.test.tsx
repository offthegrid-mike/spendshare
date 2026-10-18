import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Tag } from 'lucide-react';
import SettingsMenu from './SettingsMenu';
import { paths } from '../lib/paths';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

function renderMenu(props: ComponentProps<typeof SettingsMenu> = {}) {
  return render(
    <MemoryRouter>
      <SettingsMenu {...props} />
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
    expect(screen.getByRole('menuitem', { name: 'Categories' })).toHaveAttribute('href', paths.categories);
    expect(screen.getByRole('menuitem', { name: 'Invite' })).toHaveAttribute('href', paths.groupInvites);
    expect(screen.getByRole('menuitem', { name: 'Group settings' })).toHaveAttribute('href', paths.groupSettings);
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

  it('names the gear Settings menu and the menu Settings when given no props', async () => {
    renderMenu();
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
    await userEvent.click(gear());
    expect(screen.getByRole('menu', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').filter((el) => el.getAttribute('href'))).toHaveLength(3);
  });

  describe('with an account', () => {
    const account = { name: 'Mike', email: 'mike@example.com' };
    const avatar = () => screen.getByRole('button', { name: 'Account menu' });

    it('shows the initial in an Account menu button instead of the gear', () => {
      renderMenu({ account });
      expect(avatar()).toHaveTextContent('M');
      expect(avatar()).toHaveAttribute('aria-haspopup', 'menu');
      expect(avatar()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Settings menu' })).toBeNull();
    });

    it('opens an Account menu that starts with the name and email', async () => {
      renderMenu({ account });
      await userEvent.click(avatar());
      expect(avatar()).toHaveAttribute('aria-expanded', 'true');
      const menu = screen.getByRole('menu', { name: 'Account' });
      expect(menu).toHaveTextContent('Mike');
      expect(menu).toHaveTextContent('mike@example.com');
      expect(screen.getByText('Mike')).toBeInTheDocument();
      expect(screen.getByText('mike@example.com')).toBeInTheDocument();
    });

    it('keeps the focus, keyboard and sign-out behaviour', async () => {
      renderMenu({ account });
      await userEvent.click(avatar());
      expect(screen.getByRole('menuitem', { name: 'Categories' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(avatar()).toHaveFocus();
      await userEvent.click(avatar());
      await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('with custom links', () => {
    it('omits the manage links but keeps appearance and sign out when links is empty', async () => {
      renderMenu({ links: [] });
      await userEvent.click(gear());
      expect(screen.queryByRole('menuitem', { name: 'Categories' })).toBeNull();
      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    });

    it('leaves no leading or doubled hairline when links is empty', async () => {
      renderMenu({ links: [] });
      await userEvent.click(gear());
      // Appearance, one hairline, Sign out.
      expect(screen.getAllByRole('separator')).toHaveLength(1);
      expect(screen.getByRole('menu').firstElementChild).toBe(screen.getByRole('group', { name: 'Appearance' }));
    });

    it('separates the account block from the rest once when links is empty', async () => {
      renderMenu({ links: [], account: { name: 'Mike', email: 'mike@example.com' } });
      await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      // Name block, hairline, Appearance, hairline, Sign out.
      expect(screen.getAllByRole('separator')).toHaveLength(2);
    });

    it('renders the links it is given', async () => {
      renderMenu({ links: [{ to: '/elsewhere', label: 'Elsewhere', icon: Tag }] });
      await userEvent.click(gear());
      expect(screen.getByRole('menuitem', { name: 'Elsewhere' })).toHaveAttribute('href', '/elsewhere');
      expect(screen.queryByRole('menuitem', { name: 'Categories' })).toBeNull();
    });
  });
});
