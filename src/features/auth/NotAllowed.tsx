import { useState } from 'react';
import { sendEmailVerification, signOut, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import BrandMark from '../../components/BrandMark';
import BrandPanel from './BrandPanel';

interface Props {
  user: User;
  status: 'denied' | 'unverified';
  /** Injected so tests can see the reload without leaving the page. */
  reloadPage?: () => void;
}

/**
 * Shown to a signed-in user the Firestore rules will refuse: someone whose
 * email is not on the allowlist, or who has not verified it yet.
 */
export default function NotAllowed({ user, status, reloadPage = () => window.location.reload() }: Props) {
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setResent(true);
    } finally {
      setBusy(false);
    }
  }

  // Firebase only notices a verification after the user reloads and the ID
  // token is refreshed; the rules read email_verified from that token.
  async function checkVerified() {
    setBusy(true);
    try {
      await user.reload();
      await user.getIdToken(true);
      reloadPage();
    } finally {
      setBusy(false);
    }
  }

  const unverified = status === 'unverified';

  return (
    <main className="min-h-[100dvh] lg:grid lg:grid-cols-2">
      <BrandPanel />

      <div className="flex min-h-[100dvh] flex-col px-4 py-10 sm:px-8 lg:px-12 lg:pt-[18vh]">
        <div className="w-full max-w-[380px] self-center">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <BrandMark size="sm" />
            <span className="text-lg font-semibold tracking-tight text-ink">SpendShare</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {unverified ? 'Verify your email' : "This account can't use SpendShare"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {unverified
              ? `We sent a link to ${user.email ?? 'your email'}. Open it, then come back here.`
              : `${user.email ?? 'This account'} isn't on the list of people allowed to use this app. Ask the owner to add you, then sign in again.`}
          </p>

          {unverified && (
            <div className="mt-8 space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkVerified()}
                className="btn-primary h-11 w-full text-base"
              >
                I've verified it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resend()}
                className="btn-outline h-11 w-full text-base"
              >
                Resend the link
              </button>
              {resent && (
                <p role="status" className="text-sm text-ink-muted">
                  We've sent another link. It can take a minute to arrive.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void signOut(auth)}
            className={`btn-outline h-11 w-full text-base ${unverified ? 'mt-3' : 'mt-8'}`}
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
