import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useGroups } from './hooks/useGroups';
import { useUIStore } from './stores/uiStore';
import SignIn from './features/auth/SignIn';
import Layout from './components/Layout';
import CreateGroup from './features/groups/CreateGroup';
import GroupSettings from './features/groups/GroupSettings';
import SendInvite from './features/invites/SendInvite';
import PendingInvites from './features/invites/PendingInvites';
import CategoryManager from './features/categories/CategoryManager';
import { useGroup } from './hooks/useGroup';

function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-600">SpendShare</h1>
      <p className="mt-4 text-gray-600">Expenses coming in M5.</p>
    </div>
  );
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups(user?.uid);
  const { selectedGroupId, setGroup } = useUIStore();
  const { group } = useGroup(selectedGroupId);

  // Auto-select first group if persisted selection no longer valid
  useEffect(() => {
    if (groups.length > 0 && !groups.find((g) => g.id === selectedGroupId)) {
      setGroup(groups[0].id);
    }
  }, [groups, selectedGroupId, setGroup]);

  if (authLoading || (user && groupsLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Loading…
      </main>
    );
  }

  if (!user) return <SignIn />;

  // No groups yet → create one (but still surface pending invites so an
  // invited user with no groups of their own can accept and gain access)
  if (groups.length === 0) {
    return (
      <>
        <div className="mx-auto max-w-sm px-4 pt-8 empty:hidden">
          <PendingInvites user={user} />
        </div>
        <CreateGroup user={user} />
      </>
    );
  }

  return (
    <Routes>
      <Route element={<Layout groups={groups} user={user} />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/group/settings"
          element={group ? <GroupSettings key={group.id} group={group} /> : <div>Loading…</div>}
        />
        <Route
          path="/group/invites"
          element={group ? <SendInvite key={group.id} user={user} group={group} /> : <div>Loading…</div>}
        />
        <Route
          path="/categories"
          element={selectedGroupId ? <CategoryManager /> : <div>Loading…</div>}
        />
      </Route>
    </Routes>
  );
}

export default App;
