import { useLocation, Link } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import GroupSwitcher from './GroupSwitcher';
import MonthPicker from './MonthPicker';
import type { GroupDoc } from '../types/models';

const TITLE_MAP: Record<string, string> = {
  '/':               'Expenses',
  '/income':         'Income',
  '/summary':        'Summary',
  '/more':           'More',
  '/search':         'Search',
  '/expense/new':    'New Expense',
  '/categories':     'Categories',
  '/group/settings': 'Settings',
  '/group/invites':  'Invites',
};

function getTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (/^\/expense\/.+\/edit$/.test(pathname)) return 'Edit Expense';
  return 'SpendShare';
}

interface Props { groups: GroupDoc[]; user: User; }

export default function MobileHeader({ groups, user }: Props) {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-20 bg-brand-gradient shadow-lg shadow-brand-900/10 ring-1 ring-black/5 sm:hidden">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <h1 className="flex-1 text-xl font-extrabold tracking-tight text-white">
          {getTitle(pathname)}
        </h1>
        <Link
          to="/search"
          aria-label="Search"
          className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <Search size={16} />
        </Link>
        <GroupSwitcher groups={groups} />
        <button
          type="button"
          onClick={() => void signOut(auth)}
          title={user.displayName ?? 'Sign out'}
          aria-label="Sign out"
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
      {pathname !== '/search' && (
        <div className="px-4 pb-2.5">
          <MonthPicker />
        </div>
      )}
    </header>
  );
}
