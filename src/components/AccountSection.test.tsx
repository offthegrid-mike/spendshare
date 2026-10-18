import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSection from './AccountSection';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => signOut(...args) }));

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
});

describe('AccountSection', () => {
  it('renders the appearance switch', () => {
    render(<AccountSection />);
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('signs out once when Sign out is clicked', async () => {
    render(<AccountSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows a loading indicator while signing out, then re-enables if it fails', async () => {
    let rejectSignOut!: (e: unknown) => void;
    signOut.mockReturnValue(new Promise((_resolve, reject) => { rejectSignOut = reject; }));

    const u = userEvent.setup();
    render(<AccountSection />);

    await u.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Signing out…' })).toBeDisabled();

    await act(async () => {
      rejectSignOut(new Error('network error'));
      await Promise.resolve().catch(() => {});
    });

    expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeDisabled();
  });
});
