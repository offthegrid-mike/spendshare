import type { User } from 'firebase/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useTripExpenses } from '../../hooks/useTripExpenses';
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
  const { expenses, loading } = useTripExpenses(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (loading) return <RouteSkeleton />;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">{`New expense · ${trip.name}`}</h2>
      <TripExpenseEditor
        key={trip.id}
        trip={trip}
        user={user}
        expenses={expenses}
        onSaved={() => navigate(paths.trip(trip.id), { replace: true })}
      />
    </div>
  );
}

export function TripExpenseRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenses, itemsByExpense, loading, itemsLoading } = useTripExpenses(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
  if (loading || itemsLoading) return <RouteSkeleton />;
  return <TripExpenseDetail trip={trip} user={user} expenses={expenses} itemsByExpense={itemsByExpense} />;
}

export function EditTripExpenseRoute({ trips, user }: Props) {
  const trip = useTrip(trips);
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const { expenses, itemsByExpense, loading, itemsLoading } = useTripExpenses(trip?.id ?? null);
  if (!trip) return <Navigate to={paths.travel} replace />;
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
        onSaved={(id) => navigate(paths.tripExpense(trip.id, id), { replace: true })}
      />
    </div>
  );
}
