import { useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
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
import ExpenseEditor from './features/expenses/ExpenseEditor';
import { useMonthExpenses } from './hooks/useMonthExpenses';
import ExpenseList from './features/expenses/ExpenseList';
import IncomeEditor from './features/income/IncomeEditor';
import { useIncome } from './hooks/useIncome';
import Summary from './features/summary/Summary';
import MoreScreen from './features/more/MoreScreen';
import type { User } from 'firebase/auth';
import type { GroupDoc } from './types/models';

function IncomeRouteWrapper({ group, user }: { group: GroupDoc; user: User }) {
  const { selectedMonth } = useUIStore();
  const { income, loading } = useIncome(group.id, selectedMonth);
  if (loading) return <div>Loading…</div>;
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
  const { selectedMonth } = useUIStore();
  const { expenses, itemsByExpense } = useMonthExpenses(group.id, selectedMonth);
  const expense = expenses.find((e) => e.id === id);
  const items = id ? (itemsByExpense[id] ?? []) : [];
  if (!expense) return <div>Loading…</div>;
  return <ExpenseEditor group={group} currentUserUid={user.uid} expense={expense} items={items} />;
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
        <Route path="/" element={group ? <ExpenseList group={group} /> : <div>Loading…</div>} />
        <Route
          path="/group/settings"
          element={group ? <GroupSettings key={group.id} group={group} currentUserUid={user.uid} /> : <div>Loading…</div>}
        />
        <Route
          path="/group/invites"
          element={group ? <SendInvite key={group.id} user={user} group={group} /> : <div>Loading…</div>}
        />
        <Route
          path="/categories"
          element={selectedGroupId ? <CategoryManager /> : <div>Loading…</div>}
        />
        <Route
          path="/expense/new"
          element={group ? <ExpenseEditor group={group} currentUserUid={user.uid} /> : <div>Loading…</div>}
        />
        <Route
          path="/expense/:id/edit"
          element={group ? <EditExpenseRoute group={group} user={user} /> : <div>Loading…</div>}
        />
        <Route
          path="/income"
          element={
            group ? (
              <IncomeRouteWrapper group={group} user={user} />
            ) : (
              <div>Loading…</div>
            )
          }
        />
        <Route
          path="/summary"
          element={group ? <SummaryRouteWrapper group={group} user={user} /> : <div>Loading…</div>}
        />
        <Route path="/more" element={<MoreScreen />} />
      </Route>
    </Routes>
  );
}

export default App;
