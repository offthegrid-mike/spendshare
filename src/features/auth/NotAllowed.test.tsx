import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import NotAllowed from './NotAllowed';

const { signOut, sendEmailVerification, reloadPage } = vi.hoisted(() => ({
  signOut: vi.fn(),
  sendEmailVerification: vi.fn(),
  reloadPage: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({ auth: 'AUTH' }));
vi.mock('firebase/auth', () => ({
  signOut: (...args: unknown[]) => signOut(...args) as unknown,
  sendEmailVerification: (...args: unknown[]) => sendEmailVerification(...args) as unknown,
}));

function user() {
  return {
    email: 'me@example.com',
    reload: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue('token'),
  } as unknown as User & { reload: ReturnType<typeof vi.fn>; getIdToken: ReturnType<typeof vi.fn> };
}

describe('NotAllowed', () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue(undefined);
    sendEmailVerification.mockReset().mockResolvedValue(undefined);
    reloadPage.mockReset();
  });

  it('tells a user who is not on the allowlist, by email, and signs them out', async () => {
    render(<NotAllowed user={user()} status="denied" reloadPage={reloadPage} />);
    expect(screen.getByRole('heading', { name: /can't use spendshare/i })).toBeInTheDocument();
    expect(screen.getByText(/me@example\.com/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith('AUTH');
  });

  it('asks an unverified user to verify, and can resend the link', async () => {
    const u = user();
    render(<NotAllowed user={u} status="unverified" reloadPage={reloadPage} />);
    expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /resend/i }));
    expect(sendEmailVerification).toHaveBeenCalledWith(u);
    expect(await screen.findByText(/sent another link/i)).toBeInTheDocument();
  });

  it("refreshes the user's token and reloads once they say they have verified", async () => {
    const u = user();
    render(<NotAllowed user={u} status="unverified" reloadPage={reloadPage} />);

    await userEvent.click(screen.getByRole('button', { name: /i've verified/i }));
    expect(u.reload).toHaveBeenCalled();
    expect(u.getIdToken).toHaveBeenCalledWith(true);
    expect(reloadPage).toHaveBeenCalled();
  });

  it('offers no verify actions to a user who is simply not on the allowlist', () => {
    render(<NotAllowed user={user()} status="denied" reloadPage={reloadPage} />);
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /i've verified/i })).not.toBeInTheDocument();
  });
});
