import { signOut } from 'firebase/auth';
import { Outlet, Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import GroupSwitcher from './GroupSwitcher';
import type { GroupDoc } from '../types/models';

interface Props { groups: GroupDoc[]; }

export default function Layout({ groups }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <span className="text-lg font-bold text-blue-600">SpendShare</span>
        <div className="flex items-center gap-4">
          <GroupSwitcher groups={groups} />
          <Link
            to="/group/settings"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
