import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { groupsCol } from '../../lib/converters';
import { formatTripDates, validateTripInput } from '../../lib/travel/trips';
import DatePicker from '../expenses/DatePicker';
import MembersSection from '../groups/MembersSection';
import SendInvite from '../invites/SendInvite';
import type { GroupDoc } from '../../types/models';

interface Props { trip: GroupDoc; user: User; }

/**
 * A trip's name and dates, its members and invites. Any member may rename the
 * trip; only the owner may change the dates (the rules enforce both). The home
 * currency is fixed once the trip exists, since every balance is worked out in it.
 */
export default function TripSettings({ trip, user }: Props) {
  const id = useId();
  const isOwner = trip.ownerUid === user.uid;
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.trip?.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.trip?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Only the owner edits dates, so only their dates are checked. Unchanged
    // dates aren't written, so a rename never puts back dates changed elsewhere.
    const datesChanged = isOwner && (startDate !== trip.trip?.startDate || endDate !== trip.trip?.endDate);
    const problem = datesChanged
      ? validateTripInput({ name, startDate, endDate })
      : name.trim() ? null : 'Enter a trip name.';
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(groupsCol, trip.id), {
        name: name.trim(),
        ...(datesChanged ? { trip: { startDate, endDate } } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Trip</h2>
        <form onSubmit={handleSubmit} noValidate className="card space-y-4 p-4 sm:p-5">
          <div>
            <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium text-ink">Trip name</label>
            <input
              id={`${id}-name`}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="field"
            />
          </div>
          {isOwner ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-start`} className="mb-1.5 block text-sm font-medium text-ink">First day</label>
                <DatePicker id={`${id}-start`} name="First day" value={startDate} onChange={(v) => { setStartDate(v); setError(''); }} />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className="mb-1.5 block text-sm font-medium text-ink">Last day</label>
                <DatePicker id={`${id}-end`} name="Last day" value={endDate} onChange={(v) => { setEndDate(v); setError(''); }} />
              </div>
            </div>
          ) : (
            trip.trip && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Dates</p>
                <p className="text-sm text-ink">{formatTripDates(trip.trip)}</p>
                <p className="mt-1 text-xs text-ink-muted">Only the person who created the trip can change its dates.</p>
              </div>
            )
          )}
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Home currency</p>
            <p className="text-sm text-ink">{trip.currency}</p>
            <p className="mt-1 text-xs text-ink-muted">Balances and settle-up are worked out in this currency.</p>
          </div>
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </section>

      <MembersSection group={trip} currentUserUid={user.uid} />

      <SendInvite user={user} group={trip} />
    </div>
  );
}
