import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
} = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) =>
    signInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    createUserWithEmailAndPassword(...args),
  sendEmailVerification: (...args: unknown[]) => sendEmailVerification(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
}));

// Fake firebase singletons so the real init (needs IndexedDB) never runs.
const { auth, googleProvider } = vi.hoisted(() => ({
  auth: { __type: 'auth' },
  googleProvider: { __type: 'googleProvider' },
}));
vi.mock('../src/lib/firebase', () => ({
  auth,
  googleProvider,
}));

import SignIn from '../src/features/auth/SignIn';

function getEmailInput() {
  return screen.getByLabelText(/email/i);
}
function getPasswordInput() {
  return screen.getByLabelText(/password/i);
}

describe('SignIn', () => {
  beforeEach(() => {
    signInWithEmailAndPassword.mockReset().mockResolvedValue({
      user: { uid: 'u1' },
    });
    createUserWithEmailAndPassword.mockReset().mockResolvedValue({
      user: { uid: 'u1' },
    });
    sendEmailVerification.mockReset().mockResolvedValue(undefined);
    signInWithPopup.mockReset().mockResolvedValue({ user: { uid: 'u1' } });
  });

  it('renders email, password, and the three controls', () => {
    render(<SignIn />);
    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it('calls signInWithEmailAndPassword with auth, email, and password', async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.type(getEmailInput(), 'alice@example.com');
    await user.type(getPasswordInput(), 'hunter2');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'alice@example.com',
      'hunter2',
    );
  });

  it('creates an account and sends a verification email', async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.type(getEmailInput(), 'bob@example.com');
    await user.type(getPasswordInput(), 'sekret99');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'bob@example.com',
      'sekret99',
    );
    await vi.waitFor(() => {
      expect(sendEmailVerification).toHaveBeenCalled();
    });
  });

  it('calls signInWithPopup with auth and googleProvider', async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(signInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
  });

  it('shows a validation message and skips auth when fields are empty', async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it('displays the error message when sign in rejects', async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error('auth/wrong-password'), {
        code: 'auth/wrong-password',
      }),
    );
    const user = userEvent.setup();
    render(<SignIn />);

    await user.type(getEmailInput(), 'alice@example.com');
    await user.type(getPasswordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(
      await screen.findByText(/auth\/wrong-password/i),
    ).toBeInTheDocument();
  });
});
