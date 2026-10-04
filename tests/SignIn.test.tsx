import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
} = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) =>
    signInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    createUserWithEmailAndPassword(...args),
  sendEmailVerification: (...args: unknown[]) => sendEmailVerification(...args),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
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

const firebaseError = (code: string) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code });

function getEmailInput() {
  return screen.getByLabelText('Email');
}
function getPasswordInput() {
  return screen.getByLabelText('Password');
}
function submitButton(name: RegExp) {
  return screen.getByRole('button', { name });
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
    sendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
    signInWithPopup.mockReset().mockResolvedValue({ user: { uid: 'u1' } });
  });

  describe('sign in mode', () => {
    it('opens on sign in with email, password, Google, and a way to create an account', () => {
      render(<SignIn />);
      expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
      expect(getEmailInput()).toHaveAttribute('autocomplete', 'email');
      expect(getPasswordInput()).toHaveAttribute('autocomplete', 'current-password');
      expect(submitButton(/^sign in$/i)).toHaveAttribute('type', 'submit');
      expect(submitButton(/continue with google/i)).toBeInTheDocument();
      expect(submitButton(/create an account/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^create account$/i })).not.toBeInTheDocument();
    });

    it('calls signInWithEmailAndPassword with auth, email, and password', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.type(getPasswordInput(), 'hunter2');
      await user.click(submitButton(/^sign in$/i));

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'alice@example.com',
        'hunter2',
      );
    });

    it('shows an error under each empty field and skips auth', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/^sign in$/i));

      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
      expect(getEmailInput()).toHaveAttribute('aria-invalid', 'true');
      expect(getEmailInput()).toHaveAccessibleDescription('Enter your email.');
      expect(getPasswordInput()).toHaveAttribute('aria-invalid', 'true');
      expect(getPasswordInput()).toHaveAccessibleDescription('Enter your password.');
    });

    it('disables the button and says what it is doing while signing in', async () => {
      signInWithEmailAndPassword.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.type(getPasswordInput(), 'hunter2');
      await user.click(submitButton(/^sign in$/i));

      expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled();
    });

    it('shows a plain-English message instead of the raw Firebase error', async () => {
      signInWithEmailAndPassword.mockRejectedValueOnce(firebaseError('auth/invalid-credential'));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.type(getPasswordInput(), 'wrong');
      await user.click(submitButton(/^sign in$/i));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "That email and password don't match.",
      );
      expect(screen.queryByText(/firebase/i)).not.toBeInTheDocument();
    });

    it('can reveal and hide the password', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      expect(getPasswordInput()).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Show password' }));
      expect(getPasswordInput()).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(getPasswordInput()).toHaveAttribute('type', 'password');
    });
  });

  describe('Google', () => {
    it('calls signInWithPopup with auth and googleProvider', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/continue with google/i));

      expect(signInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
    });

    it('stays quiet when the user closes the Google popup', async () => {
      signInWithPopup.mockRejectedValueOnce(firebaseError('auth/popup-closed-by-user'));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/continue with google/i));

      await vi.waitFor(() => {
        expect(submitButton(/continue with google/i)).toBeEnabled();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('create account mode', () => {
    it('switches to account creation and keeps the typed email', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'bob@example.com');
      await user.click(submitButton(/create an account/i));

      expect(
        screen.getByRole('heading', { level: 1, name: /create your account/i }),
      ).toBeInTheDocument();
      expect(getEmailInput()).toHaveValue('bob@example.com');
      expect(getPasswordInput()).toHaveAttribute('autocomplete', 'new-password');
      expect(getPasswordInput()).toHaveAccessibleDescription('At least 6 characters.');
      expect(submitButton(/continue with google/i)).toBeInTheDocument();
    });

    it('creates an account and sends a verification email', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/create an account/i));
      await user.type(getEmailInput(), 'bob@example.com');
      await user.type(getPasswordInput(), 'sekret99');
      await user.click(submitButton(/^create account$/i));

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'bob@example.com',
        'sekret99',
      );
      await vi.waitFor(() => {
        expect(sendEmailVerification).toHaveBeenCalledWith({ uid: 'u1' });
      });
    });

    it('rejects a password shorter than 6 characters before calling Firebase', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/create an account/i));
      await user.type(getEmailInput(), 'bob@example.com');
      await user.type(getPasswordInput(), 'abc');
      await user.click(submitButton(/^create account$/i));

      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
      expect(getPasswordInput()).toHaveAttribute('aria-invalid', 'true');
      expect(getPasswordInput()).toHaveAccessibleDescription('Use at least 6 characters.');
    });

    it('offers to sign in instead when the email already has an account', async () => {
      createUserWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError('auth/email-already-in-use'),
      );
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/create an account/i));
      await user.type(getEmailInput(), 'bob@example.com');
      await user.type(getPasswordInput(), 'sekret99');
      await user.click(submitButton(/^create account$/i));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "There's already an account with this email.",
      );
      await user.click(submitButton(/sign in instead/i));

      expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
      expect(getEmailInput()).toHaveValue('bob@example.com');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('goes back to sign in from the footer link', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/create an account/i));
      await user.click(submitButton(/^sign in$/i));

      expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
    });
  });

  describe('password reset', () => {
    it('sends a reset link to the typed email and confirms without revealing whether the account exists', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.click(submitButton(/forgot password/i));

      expect(
        screen.getByRole('heading', { level: 1, name: /reset your password/i }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
      expect(getEmailInput()).toHaveValue('alice@example.com');

      await user.click(submitButton(/send reset link/i));

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'alice@example.com');
      expect(
        await screen.findByRole('heading', { level: 1, name: /check your inbox/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/if an account exists for alice@example\.com/i),
      ).toBeInTheDocument();
    });

    it('requires an email before sending', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(submitButton(/forgot password/i));
      await user.click(submitButton(/send reset link/i));

      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(getEmailInput()).toHaveAccessibleDescription('Enter your email.');
    });

    it('returns to sign in from the confirmation', async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.click(submitButton(/forgot password/i));
      await user.click(submitButton(/send reset link/i));
      await user.click(await screen.findByRole('button', { name: /back to sign in/i }));

      expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
      expect(getEmailInput()).toHaveValue('alice@example.com');
    });

    it('confirms the same way for an email with no account, so it never reveals which emails exist', async () => {
      sendPasswordResetEmail.mockRejectedValueOnce(firebaseError('auth/user-not-found'));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'nobody@example.com');
      await user.click(submitButton(/forgot password/i));
      await user.click(submitButton(/send reset link/i));

      expect(
        await screen.findByRole('heading', { level: 1, name: /check your inbox/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows a plain-English message when the reset request fails', async () => {
      sendPasswordResetEmail.mockRejectedValueOnce(firebaseError('auth/network-request-failed'));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.type(getEmailInput(), 'alice@example.com');
      await user.click(submitButton(/forgot password/i));
      await user.click(submitButton(/send reset link/i));

      expect(await screen.findByRole('alert')).toHaveTextContent(/can't reach the server/i);
      expect(screen.getByRole('heading', { level: 1, name: /reset your password/i })).toBeInTheDocument();
    });
  });
});
