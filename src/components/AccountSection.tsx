import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { DARK_MODE_ENABLED } from '../lib/features';
import LoadingButton from './LoadingButton';
import ThemeSwitch from './ThemeSwitch';

/** The Appearance and Account (Sign out) sections shared by the More and Home screens. */
export default function AccountSection() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch {
      // Swallowed: no error UX exists for sign-out failures yet.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      {DARK_MODE_ENABLED && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">Appearance</h2>
          <ThemeSwitch />
        </section>
      )}
      <section>
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">
          Account
        </h2>
        <LoadingButton
          loading={signingOut}
          loadingText="Signing out…"
          onClick={() => void handleSignOut()}
          className="card flex min-h-[44px] w-full items-center gap-3 px-4 transition hover:bg-recessed disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="flex-1 text-left text-sm font-medium text-ink">Sign out</span>
        </LoadingButton>
      </section>
    </>
  );
}
