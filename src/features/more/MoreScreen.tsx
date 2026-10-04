import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, UserPlus, Settings, LogOut, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import LoadingButton from '../../components/LoadingButton';
import ThemeSwitch from '../../components/ThemeSwitch';
import { DARK_MODE_ENABLED } from '../../lib/features';
import { formatVersionLabel } from '../../lib/appVersion';

const manageItems = [
  { to: '/categories',     icon: Tag,      label: 'Categories'    },
  { to: '/group/invites',  icon: UserPlus, label: 'Invites'       },
  { to: '/group/settings', icon: Settings, label: 'Group settings' },
];

export default function MoreScreen() {
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
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">
          Manage
        </h2>
        <div className="card divide-y divide-line overflow-hidden">
          {manageItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[44px] items-center gap-3 px-4 transition hover:bg-recessed"
            >
              <Icon size={18} className="shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-ink">{label}</span>
              <ChevronRight size={16} className="text-ink-faint" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
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
      <p className="px-1 text-center text-xs text-ink-faint">
        {formatVersionLabel(__APP_COMMIT__, __APP_BUILT_AT__)}
      </p>
    </div>
  );
}
