import { useEffect } from 'react';
import { Navigate, Routes, Route, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useGroups } from './hooks/useGroups';
import { useUIStore } from './stores/uiStore';
import { resolveSelection } from './lib/groupSelection';
import SignIn from './features/auth/SignIn';
import GroupSettings from './features/groups/GroupSettings';
import SendInvite from './features/invites/SendInvite';
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
import HomeScreen from './features/home/HomeScreen';
import SpendGate from './features/shell/SpendGate';
import LegacyRedirect from './features/shell/LegacyRedirect';
import WorkLayout from './features/work/WorkLayout';
import TodayTab from './features/work/TodayTab';
import MonthTab from './features/work/MonthTab';
import WorkSettings from './features/work/WorkSettings';
import { paths } from './lib/paths';
import { WORK_ENABLED } from './lib/features';
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

  return (
    <Routes>
      <Route
        path={paths.home}
        element={
          WORK_ENABLED ? <HomeScreen user={user} groups={groups} group={group} /> : <Navigate to={paths.spend} replace />
        }
      />
      {WORK_ENABLED && (
        <Route path={paths.work} element={<WorkLayout user={user} />}>
          <Route index element={<TodayTab />} />
          <Route path="month" element={<MonthTab />} />
          <Route path="more" element={<WorkSettings />} />
        </Route>
      )}
      <Route path={paths.spend} element={<SpendGate groups={groups} user={user} />}>
        <Route index element={group ? <ExpenseList group={group} currentUserUid={user.uid} /> : <RouteSkeleton />} />
        <Route
          path="search"
          element={group ? <SearchScreen group={group} /> : <RouteSkeleton />}
        />
        <Route
          path="group/settings"
          element={group ? <GroupSettings key={group.id} group={group} currentUserUid={user.uid} /> : <RouteSkeleton />}
        />
        <Route
          path="group/invites"
          element={group ? <SendInvite key={group.id} user={user} group={group} /> : <RouteSkeleton />}
        />
        <Route
          path="categories"
          element={selectedGroupId ? <CategoryManager /> : <RouteSkeleton />}
        />
        <Route
          path="expense/new"
          element={
            group ? (
              <ExpenseEditor key={group.id} group={group} groups={groups} user={user} currentUserUid={user.uid} />
            ) : (
              <RouteSkeleton />
            )
          }
        />
        <Route
          path="expense/:id/edit"
          element={group ? <EditExpenseRoute group={group} user={user} /> : <RouteSkeleton />}
        />
        <Route
          path="income"
          element={
            group ? (
              <IncomeRouteWrapper group={group} user={user} />
            ) : (
              <RouteSkeleton />
            )
          }
        />
        <Route
          path="summary"
          element={group ? <SummaryRouteWrapper group={group} user={user} /> : <RouteSkeleton />}
        />
        <Route path="more" element={<MoreScreen />} />
      </Route>
      <Route path="*" element={<LegacyRedirect />} />
    </Routes>
  );
}

export default App;
