import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignIn from './SignIn';

const { signInWithPopup } = vi.hoisted(() => ({ signInWithPopup: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ auth: {}, googleProvider: {} }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args) as unknown,
}));

function fields() {
  return {
    email: screen.getByLabelText('Email') as HTMLInputElement,
    password: screen.getByLabelText('Password') as HTMLInputElement,
  };
}

describe('SignIn with Google', () => {
  beforeEach(() => {
    signInWithPopup.mockReset();
  });

  it('disables the email and password fields while the Google popup is open', async () => {
    signInWithPopup.mockReturnValue(new Promise(() => {}));
    render(<SignIn />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    const { email, password } = fields();
    expect(email.matches(':disabled')).toBe(true);
    expect(password.matches(':disabled')).toBe(true);
  });

  it('re-enables the fields when Google sign-in fails', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    render(<SignIn />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    const { email, password } = fields();
    expect(email.matches(':disabled')).toBe(false);
    expect(password.matches(':disabled')).toBe(false);
  });

  it('keeps the fields disabled after Google sign-in succeeds', async () => {
    signInWithPopup.mockResolvedValue({});
    render(<SignIn />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    const { email, password } = fields();
    expect(email.matches(':disabled')).toBe(true);
    expect(password.matches(':disabled')).toBe(true);
  });
});
