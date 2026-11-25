import { useEffect, useMemo } from 'react';
import { Navigate, Routes, Route, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAllowlist } from './hooks/useAllowlist';
import { useGroups } from './hooks/useGroups';
import { useUIStore } from './stores/uiStore';
import { resolveSelection } from './lib/groupSelection';
import { splitGroups } from './lib/travel/trips';
import SignIn from './features/auth/SignIn';
import NotAllowed from './features/auth/NotAllowed';
import GroupSettings from './features/groups/GroupSettings';
import SendInvite from './features/invites/SendInvite';
import CategoryManager from './features/categories/CategoryManager';
import { useGroup } from './hooks/useGroup';
import ExpenseEditor from './features/expenses/ExpenseEditor';
import RefundRoute from './features/expenses/RefundRoute';
import TagsScreen from './features/tags/TagsScreen';
import TagScreen from './features/tags/TagScreen';
import PriceScreen from './features/prices/PriceScreen';
import { useExpense } from './hooks/useExpense';
import { useRefunds } from './hooks/useRefunds';
import { isRefund, refundedTotal } from './lib/refund';
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
import YearTab from './features/work/YearTab';
import WorkSettings from './features/work/WorkSettings';
import TravelLayout from './features/travel/TravelLayout';
import TripList from './features/travel/TripList';
import TripScreen from './features/travel/TripScreen';
import TripSettings from './features/travel/TripSettings';
import NewTripScreen from './features/travel/NewTripScreen';
import {
  EditTripExpenseRoute, NewTripExpenseRoute, TripCashRoute, TripExpenseRoute, TripSummaryRoute,
} from './features/travel/tripRoutes';
import { paths } from './lib/paths';
import { TRAVEL_ENABLED, WORK_ENABLED } from './lib/features';
import { AppSplash, RouteSkeleton } from './components/AppSkeletons';
import type { User } from 'firebase/auth';
import type { ExpenseDoc, GroupDoc, ItemDoc } from './types/models';

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
  if (isRefund(expense) && expense.refundOf) {
    return (
      <RefundRoute group={group} currentUserUid={user.uid} originalId={expense.refundOf} refund={expense} refundItems={items} />
    );
  }
  return <PurchaseEditRoute group={group} user={user} expense={expense} items={items} />;
}

/** Editing a purchase, whose total can't drop below what has been refunded from it. */
function PurchaseEditRoute({ group, user, expense, items }: { group: GroupDoc; user: User; expense: ExpenseDoc; items: ItemDoc[] }) {
  const { refunds, loading, error } = useRefunds(group.id, expense.id);
  if (loading) return <RouteSkeleton />;
  // Without its refunds the floor on its total is unknown, so don't guess it's zero.
  if (error) return <p className="text-sm text-negative">Could not load this expense's refunds. Please try again.</p>;
  return (
    <ExpenseEditor
      key={expense.id}
      group={group}
      currentUserUid={user.uid}
      expense={expense}
      items={items}
      refunded={refundedTotal(refunds)}
    />
  );
}

function TagRoute({ group }: { group: GroupDoc }) {
  const { tag } = useParams<{ tag: string }>();
  // The key starts each tag's page fresh.
  return tag ? <TagScreen key={tag} group={group} tag={tag} /> : null;
}

function PriceRoute({ group }: { group: GroupDoc }) {
  const { name } = useParams<{ name: string }>();
  // The key starts each item's page fresh.
  return name ? <PriceScreen key={name} group={group} name={name} /> : null;
}

function RefundExpenseRoute({ group, user }: { group: GroupDoc; user: User }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <RefundRoute group={group} currentUserUid={user.uid} originalId={id} />;
}

function TripSettingsRoute({ trips, user }: { trips: GroupDoc[]; user: User }) {
  const { tripId } = useParams<{ tripId: string }>();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return <Navigate to={paths.travel} replace />;
  // The key starts each trip's form fresh.
  return <TripSettings key={trip.id} trip={trip} user={user} />;
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const access = useAllowlist(user);
  // Load nothing for someone the rules would refuse; every read would fail.
  const allowedUser = access === 'allowed' ? user : null;
  const { groups: allGroups, loading: groupsLoading } = useGroups(allowedUser?.uid);
  // Trips are groups too, but every household screen, the switcher and the
  // selection only ever see households; trips live under /travel.
  const { households: groups, trips } = useMemo(() => splitGroups(allGroups), [allGroups]);
  const { selectedGroupId, setGroup, pendingGroupId, clearPendingGroup } = useUIStore();
  const { group } = useGroup(allowedUser ? selectedGroupId : null);

  // Keep the selection valid, and select a just-joined group once it arrives.
  useEffect(() => {
    const { select, clearPending } = resolveSelection(groups, selectedGroupId, pendingGroupId);
    if (select) setGroup(select);
    if (clearPending) clearPendingGroup();
  }, [groups, selectedGroupId, pendingGroupId, setGroup, clearPendingGroup]);

  if (authLoading || access === 'loading' || (allowedUser && groupsLoading)) {
    return <AppSplash />;
  }

  if (!user) return <SignIn />;
  if (access === 'denied' || access === 'unverified') return <NotAllowed user={user} status={access} />;

  return (
    <Routes>
      <Route
        path={paths.home}
        element={
          WORK_ENABLED ? <HomeScreen user={user} groups={groups} group={group} trips={trips} /> : <Navigate to={paths.spend} replace />
        }
      />
      {WORK_ENABLED && (
        <Route path={paths.work} element={<WorkLayout user={user} />}>
          <Route index element={<TodayTab />} />
          <Route path="month" element={<MonthTab />} />
          <Route path="year" element={<YearTab />} />
          <Route path="more" element={<WorkSettings />} />
        </Route>
      )}
      {TRAVEL_ENABLED && (
        <Route path={paths.travel} element={<TravelLayout />}>
          <Route index element={<TripList trips={trips} user={user} />} />
          <Route path="new" element={<NewTripScreen user={user} defaultCurrency={(groups.find((g) => g.id === selectedGroupId) ?? groups[0])?.currency ?? 'AUD'} />} />
          <Route path=":tripId" element={<TripScreen trips={trips} viewerUid={user.uid} />} />
          <Route path=":tripId/settings" element={<TripSettingsRoute trips={trips} user={user} />} />
          <Route path=":tripId/summary" element={<TripSummaryRoute trips={trips} user={user} />} />
          <Route path=":tripId/cash" element={<TripCashRoute trips={trips} user={user} />} />
          <Route path=":tripId/expense/new" element={<NewTripExpenseRoute trips={trips} user={user} />} />
          <Route path=":tripId/expense/:expenseId" element={<TripExpenseRoute trips={trips} user={user} />} />
          <Route path=":tripId/expense/:expenseId/edit" element={<EditTripExpenseRoute trips={trips} user={user} />} />
        </Route>
      )}
      <Route path={paths.spend} element={<SpendGate groups={groups} user={user} />}>
        <Route index element={group ? <ExpenseList group={group} currentUserUid={user.uid} /> : <RouteSkeleton />} />
        <Route
          path="search"
          element={group ? <SearchScreen group={group} /> : <RouteSkeleton />}
        />
        <Route path="tags" element={group ? <TagsScreen group={group} /> : <RouteSkeleton />} />
        <Route path="tags/:tag" element={group ? <TagRoute group={group} /> : <RouteSkeleton />} />
        <Route path="prices/:name" element={group ? <PriceRoute group={group} /> : <RouteSkeleton />} />
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
          path="expense/:id/refund"
          element={group ? <RefundExpenseRoute group={group} user={user} /> : <RouteSkeleton />}
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
