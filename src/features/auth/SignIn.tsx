import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    if (!email || !password) {
      setValidationError('Email and password are required.');
      return false;
    }
    setValidationError('');
    return true;
  }

  async function handleSignIn() {
    setAuthError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount() {
    setAuthError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await sendEmailVerification(result.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setAuthError('');
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-accent">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16v14l-2.5-1.5L15 18l-3-1.5L9 18l-2.5-1.5L4 18z" />
              <path d="M9 8h6M9 12h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            SpendShare
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Split expenses, settle up, stay friends.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSignIn();
          }}
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-ink"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-ink"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>

          {validationError && (
            <p className="text-sm text-negative" role="alert">
              {validationError}
            </p>
          )}
          {authError && (
            <p className="text-sm text-negative" role="alert">
              {authError}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
            Sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreateAccount()}
            className="btn-outline w-full py-2.5"
          >
            Create account
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGoogle()}
            className="btn-outline w-full py-2.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.2a7.2 7.2 0 0 1 0-4.5V6.6H1.4a12 12 0 0 0 0 10.8z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.6l3.9 3.1A7.2 7.2 0 0 1 12 4.8z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
