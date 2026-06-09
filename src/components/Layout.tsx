import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Outlet, NavLink } from 'react-router-dom';
import {
  ReceiptText,
  TrendingUp,
  BarChart2,
  Tag,
  UserPlus,
  Settings,
  LogOut,
  Plus,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import GroupSwitcher from './GroupSwitcher';
import MonthPicker from './MonthPicker';
import PendingInvites from '../features/invites/PendingInvites';
import type { GroupDoc } from '../types/models';

interface Props { groups: GroupDoc[]; user: User; }

const navItems = [
  { to: '/income',         icon: TrendingUp,  label: 'Income'     },
  { to: '/summary',        icon: BarChart2,   label: 'Summary'    },
  { to: '/categories',     icon: Tag,         label: 'Categories' },
  { to: '/group/invites',  icon: UserPlus,    label: 'Invite'     },
  { to: '/group/settings', icon: Settings,    label: 'Settings'   },
];

export default function Layout({ groups, user }: Props) {
  const navLink =
    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ' +
    'text-blue-100 hover:bg-white/20 [&.active]:bg-white [&.active]:text-blue-700';

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-gradient-to-r from-blue-700 to-blue-600 shadow-md">
        <div className="flex items-center justify-between px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold tracking-tight text-white">SpendShare</span>
            <GroupSwitcher groups={groups} />
            <MonthPicker />
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to="/expense/new"
              className="flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} />
              Expense
            </NavLink>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              title={user.displayName ?? 'Sign out'}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-blue-100 hover:bg-white/20 transition-colors"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          <NavLink to="/" end className={navLink}>
            <ReceiptText size={15} />
            Expenses
          </NavLink>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={navLink}>
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 empty:mb-0">
          <PendingInvites user={user} />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
