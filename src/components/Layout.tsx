import { signOut } from 'firebase/auth';
import { Outlet } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <span className="text-lg font-bold text-blue-600">SpendShare</span>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-600">{user.email}</span>
          )}
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
