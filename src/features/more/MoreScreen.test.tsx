import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MoreScreen from './MoreScreen';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

function renderMore() {
  return render(<MemoryRouter><MoreScreen /></MemoryRouter>);
}

describe('MoreScreen', () => {
  it('renders Categories link pointing to /categories', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /categories/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/categories');
  });

  it('renders Invites link pointing to /group/invites', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /invites/i });
    expect(link.getAttribute('href')).toBe('/group/invites');
  });

  it('renders Group settings link pointing to /group/settings', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /group settings/i });
    expect(link.getAttribute('href')).toBe('/group/settings');
  });

  it('renders a Sign out button', () => {
    renderMore();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('disables the button and shows a loading indicator while signing out, then re-enables if it fails', async () => {
    let rejectSignOut!: (e: unknown) => void;
    signOut.mockReturnValue(new Promise((_resolve, reject) => { rejectSignOut = reject; }));

    const u = userEvent.setup();
    renderMore();

    await u.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('button', { name: /signing out/i })).toBeDisabled();

    await act(async () => {
      rejectSignOut(new Error('network error'));
      await Promise.resolve().catch(() => {});
    });

    expect(screen.getByRole('button', { name: /sign out/i })).not.toBeDisabled();
  });
});
