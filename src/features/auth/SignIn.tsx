import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
} from 'firebase/auth';
import { ArrowLeft, CircleAlert, Eye, EyeOff } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import BrandMark from '../../components/BrandMark';
import BrandPanel from './BrandPanel';
import { authErrorCode, authErrorMessage } from './authErrors';

type Mode = 'signIn' | 'create' | 'reset' | 'resetSent';

const COPY: Record<Mode, { title: string; lead: string; submit: string; busy: string }> = {
  signIn: {
    title: 'Welcome back',
    lead: 'Sign in to your household.',
    submit: 'Sign in',
    busy: 'Signing in…',
  },
  create: {
    title: 'Create your account',
    lead: 'Then start a household, or join one you were invited to.',
    submit: 'Create account',
    busy: 'Creating account…',
  },
  reset: {
    title: 'Reset your password',
    lead: "We'll email you a link to choose a new one.",
    submit: 'Send reset link',
    busy: 'Sending…',
  },
  resetSent: { title: 'Check your inbox', lead: '', submit: '', busy: '' },
};

/** Firebase's own minimum, checked here so the user isn't sent a round trip to learn it. */
const MIN_PASSWORD_LENGTH = 6;

const INVALID = 'border-negative focus:border-negative focus:ring-negative/25';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState<'form' | 'google' | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusHeading = useRef(false);

  // The button that switched modes is gone after the switch, so move focus to
  // the new heading; screen readers then announce where the user landed.
  useEffect(() => {
    if (focusHeading.current) {
      focusHeading.current = false;
      headingRef.current?.focus();
    }
  }, [mode]);

  function switchMode(next: Mode) {
    focusHeading.current = true;
    setMode(next);
    setFieldErrors({});
    setAuthError(null);
    setShowPassword(false);
  }

  function showError(err: unknown) {
    const code = authErrorCode(err);
    const message = authErrorMessage(code);
    setAuthError(message ? { code, message } : null);
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email.';
    if (mode !== 'reset') {
      if (!password) errors.password = 'Enter your password.';
      else if (mode === 'create' && password.length < MIN_PASSWORD_LENGTH) {
        errors.password = 'Use at least 6 characters.';
      }
    }
    setFieldErrors(errors);
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    return !errors.email && !errors.password;
  }

  async function requestReset(address: string) {
    try {
      await sendPasswordResetEmail(auth, address);
    } catch (err) {
      // Projects without email enumeration protection report unknown
      // addresses. Confirm anyway so the screen never reveals who has an account.
      if (authErrorCode(err) !== 'auth/user-not-found') throw err;
    }
    switchMode('resetSent');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!validate()) return;
    const address = email.trim();
    setBusy('form');
    try {
      if (mode === 'signIn') {
        await signInWithEmailAndPassword(auth, address, password);
      } else if (mode === 'create') {
        const result = await createUserWithEmailAndPassword(auth, address, password);
        await sendEmailVerification(result.user);
      } else {
        await requestReset(address);
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setAuthError(null);
    setBusy('google');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }

  const copy = COPY[mode];
  const passwordHint = mode === 'create' ? 'At least 6 characters.' : null;
  const passwordDescription = fieldErrors.password
    ? 'password-error'
    : passwordHint
      ? 'password-hint'
      : undefined;

  return (
    <main className="min-h-[100dvh] lg:grid lg:grid-cols-2">
      <BrandPanel />

      {/* Top-anchored rather than centred, so the heading stays put when an
          error appears or the mode changes the form's height. */}
      <div className="flex min-h-[100dvh] flex-col px-4 py-10 sm:px-8 lg:px-12 lg:pt-[18vh]">
        <div className="w-full max-w-[380px] self-center">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <BrandMark size="sm" />
            <span className="text-lg font-semibold tracking-tight text-ink">SpendShare</span>
          </div>

          <div key={mode} className="motion-safe:animate-fade-in">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight text-ink outline-none"
            >
              {copy.title}
            </h1>

            {mode === 'resetSent' ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {`If an account exists for ${email.trim()}, we've sent a link to reset your password. It can take a minute to arrive.`}
                </p>
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className="btn-outline mt-8 h-11 w-full text-base"
                >
                  <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-sm text-ink-muted">{copy.lead}</p>

                <form noValidate className="mt-8 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                      Email
                    </label>
                    <input
                      ref={emailRef}
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      className={`field h-11 text-base ${fieldErrors.email ? INVALID : ''}`}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className="mt-1.5 text-sm text-negative">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {mode !== 'reset' && (
                    <div>
                      <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          ref={passwordRef}
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-invalid={fieldErrors.password ? true : undefined}
                          aria-describedby={passwordDescription}
                          className={`field h-11 pr-11 text-base ${fieldErrors.password ? INVALID : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((shown) => !shown)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[10px] text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          {showPassword ? (
                            <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
                          ) : (
                            <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-start justify-between gap-3">
                        {fieldErrors.password ? (
                          <p id="password-error" className="text-sm text-negative">
                            {fieldErrors.password}
                          </p>
                        ) : (
                          passwordHint && (
                            <p id="password-hint" className="text-sm text-ink-muted">
                              {passwordHint}
                            </p>
                          )
                        )}
                        {mode === 'signIn' && (
                          <TextButton onClick={() => switchMode('reset')} className="ml-auto">
                            Forgot password?
                          </TextButton>
                        )}
                      </div>
                    </div>
                  )}

                  {authError && (
                    <div
                      role="alert"
                      // A 5% tint keeps the red text above 4.5:1 in light mode; 10% drops it to 4.26.
                      className="flex gap-2.5 rounded-[10px] border border-negative/20 bg-negative/5 px-3 py-2.5 text-sm text-negative"
                    >
                      <CircleAlert size={18} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden="true" />
                      <p>
                        {authError.message}
                        {authError.code === 'auth/email-already-in-use' && (
                          <>
                            {' '}
                            <button
                              type="button"
                              onClick={() => switchMode('signIn')}
                              className="font-semibold underline underline-offset-2"
                            >
                              Sign in instead
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <button type="submit" disabled={busy !== null} className="btn-primary h-11 w-full text-base">
                    {busy === 'form' ? copy.busy : copy.submit}
                  </button>
                </form>

                {mode !== 'reset' && (
                  <>
                    <div className="my-6 flex items-center gap-3">
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-xs font-medium text-ink-muted">or</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleGoogle()}
                      className="btn-outline h-11 w-full text-base"
                    >
                      <GoogleLogo />
                      Continue with Google
                    </button>
                  </>
                )}

                <p className="mt-8 text-sm text-ink-muted">
                  {mode === 'signIn' && (
                    <>
                      New here?{' '}
                      <TextButton onClick={() => switchMode('create')}>Create an account</TextButton>
                    </>
                  )}
                  {mode === 'create' && (
                    <>
                      Already have an account?{' '}
                      <TextButton onClick={() => switchMode('signIn')}>Sign in</TextButton>
                    </>
                  )}
                  {mode === 'reset' && (
                    <TextButton onClick={() => switchMode('signIn')} className="inline-flex items-center gap-1.5">
                      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                      Back to sign in
                    </TextButton>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function TextButton({
  onClick,
  className = '',
  children,
}: {
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded font-semibold text-accent-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${className}`}
    >
      {children}
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.2a7.2 7.2 0 0 1 0-4.5V6.6H1.4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.6l3.9 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}
