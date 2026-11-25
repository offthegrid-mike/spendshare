import type { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { paths } from '../../lib/paths';
import NewTripForm from './NewTripForm';

/** The new-trip page; once the trip exists it opens it, replacing this page in history. */
export default function NewTripScreen({ user, defaultCurrency }: { user: User; defaultCurrency: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold text-ink">New trip</h2>
      <NewTripForm
        user={user}
        defaultCurrency={defaultCurrency}
        onCreated={(id) => navigate(paths.trip(id), { replace: true })}
      />
      <p className="px-1 text-center text-xs text-ink-muted">Next, invite the people going from the trip’s settings.</p>
    </div>
  );
}
