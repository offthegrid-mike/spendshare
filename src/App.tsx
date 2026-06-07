import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useGroups } from './hooks/useGroups';
import { useUIStore } from './stores/uiStore';
import SignIn from './features/auth/SignIn';
import Layout from './components/Layout';
import CreateGroup from './features/groups/CreateGroup';
import GroupSettings from './features/groups/GroupSettings';
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

  // No groups yet → create one
  if (groups.length === 0) return <CreateGroup user={user} />;

  return (
    <Routes>
      <Route element={<Layout groups={groups} />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/group/settings"
          element={group ? <GroupSettings key={group.id} group={group} /> : <div>Loading…</div>}
        />
      </Route>
    </Routes>
  );
}

export default App;
