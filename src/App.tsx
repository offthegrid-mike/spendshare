import { useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useGroups } from './hooks/useGroups';
import { useUIStore } from './stores/uiStore';
import { resolveSelection } from './lib/groupSelection';
import SignIn from './features/auth/SignIn';
import Layout from './components/Layout';
import CreateGroup from './features/groups/CreateGroup';
import GroupSettings from './features/groups/GroupSettings';
import SendInvite from './features/invites/SendInvite';
import PendingInvites from './features/invites/PendingInvites';
import CategoryManager from './features/categories/CategoryManager';
import { useGroup } from './hooks/useGroup';
import ExpenseEditor from './features/expenses/ExpenseEditor';
import { useExpense } from './hooks/useExpense';
import ExpenseList from './features/expenses/ExpenseList';
import IncomeEditor from './features/income/IncomeEditor';
import { useIncome } from './hooks/useIncome';
import Summary from './features/summary/Summary';
import MoreScreen from './features/more/MoreScreen';
import SearchScreen from './features/search/SearchScreen';
import { AppSplash, RouteSkeleton } from './components/AppSkeletons';
import type { User } from 'firebase/auth';
import type { GroupDoc } from './types/models';

function IncomeRouteWrapper({ group, user }: { group: GroupDoc; user: User }) {
  const { selectedMonth } = useUIStore();
  const { income, loading } = useIncome(group.id, selectedMonth);
  if (loading) return <RouteSkeleton />;
  return (
    <IncomeEditor
      key={selectedMonth}
      group={group}
      currentUserUid={user.uid}
      selectedMonth={selectedMonth}
      income={income}
    />
  );
}

function SummaryRouteWrapper({ group, user }: { group: GroupDoc; user: User }) {
  const { selectedMonth } = useUIStore();
  return <Summary group={group} currentUserUid={user.uid} selectedMonth={selectedMonth} />;
}

function EditExpenseRoute({ group, user }: { group: GroupDoc; user: User }) {
  const { id } = useParams<{ id: string }>();
  const { expense, items, loading } = useExpense(group.id, id);
  if (loading) return <RouteSkeleton />;
  if (!expense) return <div className="text-sm text-ink-muted">Expense not found.</div>;
  return (
    <ExpenseEditor key={expense.id} group={group} currentUserUid={user.uid} expense={expense} items={items} />
  );
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups(user?.uid);
  const { selectedGroupId, setGroup, pendingGroupId, clearPendingGroup } = useUIStore();
  const { group } = useGroup(selectedGroupId);

  // Keep the selection valid, and select a just-joined group once it arrives.
  useEffect(() => {
    const { select, clearPending } = resolveSelection(groups, selectedGroupId, pendingGroupId);
    if (select) setGroup(select);
    if (clearPending) clearPendingGroup();
  }, [groups, selectedGroupId, pendingGroupId, setGroup, clearPendingGroup]);

  if (authLoading || (user && groupsLoading)) {
    return <AppSplash />;
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
        <Route path="/" element={group ? <ExpenseList group={group} currentUserUid={user.uid} /> : <RouteSkeleton />} />
        <Route
          path="/search"
          element={group ? <SearchScreen group={group} /> : <RouteSkeleton />}
        />
        <Route
          path="/group/settings"
          element={group ? <GroupSettings key={group.id} group={group} currentUserUid={user.uid} /> : <RouteSkeleton />}
        />
        <Route
          path="/group/invites"
          element={group ? <SendInvite key={group.id} user={user} group={group} /> : <RouteSkeleton />}
        />
        <Route
          path="/categories"
          element={selectedGroupId ? <CategoryManager /> : <RouteSkeleton />}
        />
        <Route
          path="/expense/new"
          element={
            group ? (
              <ExpenseEditor key={group.id} group={group} groups={groups} user={user} currentUserUid={user.uid} />
            ) : (
              <RouteSkeleton />
            )
          }
        />
        <Route
          path="/expense/:id/edit"
          element={group ? <EditExpenseRoute group={group} user={user} /> : <RouteSkeleton />}
        />
        <Route
          path="/income"
          element={
            group ? (
              <IncomeRouteWrapper group={group} user={user} />
            ) : (
              <RouteSkeleton />
            )
          }
        />
        <Route
          path="/summary"
          element={group ? <SummaryRouteWrapper group={group} user={user} /> : <RouteSkeleton />}
        />
        <Route path="/more" element={<MoreScreen />} />
      </Route>
    </Routes>
  );
}

export default App;
