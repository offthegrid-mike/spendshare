import type { User } from 'firebase/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useSettlements } from '../../hooks/useSettlements';
import { useTripData } from '../../hooks/useTripData';
import { TRIP_SETTLEMENT_MONTH } from '../../lib/travel/valueTrip';
import { isTripClosed } from '../../lib/travel/trips';
import TripSummary from './TripSummary';
import TripCash from './TripCash';
import { paths } from '../../lib/paths';
import TripExpenseDetail from './TripExpenseDetail';
import TripExpenseEditor from './TripExpenseEditor';
import type { GroupDoc } from '../../types/models';

interface Props { trips: GroupDoc[]; user: User; }

/** The trip in the URL, or null for one the user isn't on. */
function useTrip(trips: GroupDoc[]): GroupDoc | null {
  const { tripId } = useParams<{ tripId: string }>();
  return trips.find((t) => t.id === tripId && t.trip) ?? null;
}

export function NewTripExpenseRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const navigate = useNavigate();
  // Waits for the trip's expenses, so the last currency and rate can be offered.
  const { expenses, cash, loading } = useTripData(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (isTripClosed(trip)) return <Navigate to={paths.trip(trip.id)} replace />;
  if (loading) return <RouteSkeleton />;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">{`New expense · ${trip.name}`}</h2>
      <TripExpenseEditor
        key={trip.id}
        trip={trip}
        user={user}
        expenses={expenses}
        cash={cash}
        onSaved={() => navigate(paths.trip(trip.id), { replace: true })}
      />
    </div>
  );
}

export function TripExpenseRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenses, itemsByExpense, cash, loading, itemsLoading } = useTripData(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (loading || itemsLoading) return <RouteSkeleton />;
  return <TripExpenseDetail trip={trip} user={user} expenses={expenses} itemsByExpense={itemsByExpense} cash={cash} />;
}

export function EditTripExpenseRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const { expenses, itemsByExpense, cash, loading, itemsLoading } = useTripData(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (isTripClosed(trip)) return <Navigate to={paths.tripExpense(trip.id, expenseId ?? '')} replace />;
  // The form takes its starting values once, so it waits for the items too.
  if (loading || itemsLoading) return <RouteSkeleton />;
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return <Navigate to={paths.trip(trip.id)} replace />;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">Edit expense</h2>
      <TripExpenseEditor
        key={expense.id}
        trip={trip}
        user={user}
        expenses={expenses}
        existing={{ expense, items: itemsByExpense[expense.id] ?? [] }}
        cash={cash}
        onSaved={(id) => navigate(paths.tripExpense(trip.id, id), { replace: true })}
      />
    </div>
  );
}

export function TripSummaryRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenses, itemsByExpense, cash, loading, itemsLoading } = useTripData(trip?.id ?? null);
  const { settlements, loading: settlementsLoading } = useSettlements(trip?.id ?? null, TRIP_SETTLEMENT_MONTH);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (loading || itemsLoading || settlementsLoading) return <RouteSkeleton />;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">{`Balances · ${trip.name}`}</h2>
      <TripSummary
        trip={trip} user={user} expenses={expenses} itemsByExpense={itemsByExpense} settlements={settlements} cash={cash}
      />
    </div>
  );
}

export function TripCashRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenses, cash, loading } = useTripData(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (loading) return <RouteSkeleton />;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">{`Cash · ${trip.name}`}</h2>
      <TripCash trip={trip} user={user} cash={cash} expenses={expenses} />
    </div>
  );
}
