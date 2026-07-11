import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, UserPlus, Settings, LogOut, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import LoadingButton from '../../components/LoadingButton';

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
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Manage
        </p>
        <div className="space-y-1">
          {manageItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-4 shadow-card backdrop-blur-sm transition hover:bg-white"
            >
              <Icon size={18} className="shrink-0 text-brand-600" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-slate-800">{label}</span>
              <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Account
        </p>
        <LoadingButton
          loading={signingOut}
          loadingText="Signing out…"
          onClick={() => void handleSignOut()}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-4 shadow-card backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
          <span className="flex-1 text-left text-sm font-medium text-slate-800">Sign out</span>
        </LoadingButton>
      </section>
    </div>
  );
}
