import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { deleteField, doc, Timestamp, updateDoc } from 'firebase/firestore';
import ConfirmDialog from '../../components/ConfirmDialog';
import Select from '../../components/ui/Select';
import { currencyOptions } from '../../lib/travel/currency';
import { groupsCol } from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import { closedText, formatTripDates, isTripClosed, validateTripInput } from '../../lib/travel/trips';
import DatePicker from '../expenses/DatePicker';
import MembersSection from '../groups/MembersSection';
import SendInvite from '../invites/SendInvite';
import { changeTripCurrency, deleteTrip } from './tripAdmin';
import type { GroupDoc } from '../../types/models';

const CURRENCY_OPTIONS = currencyOptions().map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

/** Whether anything is on the trip yet, and its cash wallets (all empty when nothing is). */
export interface TripRecords { empty: boolean; walletIds: string[] }

interface Props {
  trip: GroupDoc;
  user: User;
  /** What's on the trip; leave out while it loads, and the home currency stays fixed. */
  records?: TripRecords;
  /** Called once the trip is deleted. */
  onDeleted?: () => void;
}

/**
 * A trip's name and dates, its members and invites. Any member may rename the
 * trip; only the owner may change the dates (the rules enforce both). The owner
 * may change the home currency, and delete the trip. The home currency is fixed
 * once anything is on the trip, since every amount is valued in it.
 */
export default function TripSettings({ trip, user, records, onDeleted }: Props) {
  const id = useId();
  const isOwner = trip.ownerUid === user.uid;
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.trip?.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.trip?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const closed = isTripClosed(trip);
  const [currency, setCurrency] = useState(trip.currency);
  const canChangeCurrency = isOwner && !closed && records?.empty === true;

  function remove() {
    setConfirmingDelete(false);
    setDeleting(true);
    setDeleteError('');
    deleteTrip(trip)
      .then(() => onDeleted?.())
      .catch(() => {
        setDeleteError("Couldn't delete the trip. Check your connection and try again.");
        setDeleting(false);
      });
  }

  function setClosed(close: boolean) {
    setConfirmingClose(false);
    // A client time, not serverTimestamp(): a pending server time reads back as null,
    // so the trip would look open (and take new expenses) until the close synced.
    settleWrite(updateDoc(doc(groupsCol, trip.id), { tripClosedAt: close ? Timestamp.now() : deleteField() }))
      .catch(() => setError(close ? "Couldn't close the trip. Try again." : "Couldn't reopen the trip. Try again."));
  }

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
      const fields = { name: name.trim(), ...(datesChanged ? { trip: { startDate, endDate } } : {}) };
      if (canChangeCurrency && currency !== trip.currency) {
        await changeTripCurrency(trip.id, { ...fields, currency }, records?.walletIds ?? []);
      } else {
        await settleWrite(updateDoc(doc(groupsCol, trip.id), fields));
      }
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
              disabled={closed}
              className="field"
            />
          </div>
          {isOwner ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-start`} className="mb-1.5 block text-sm font-medium text-ink">First day</label>
                <DatePicker id={`${id}-start`} name="First day" disabled={closed} value={startDate} onChange={(v) => { setStartDate(v); setError(''); }} />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className="mb-1.5 block text-sm font-medium text-ink">Last day</label>
                <DatePicker id={`${id}-end`} name="Last day" disabled={closed} value={endDate} onChange={(v) => { setEndDate(v); setError(''); }} />
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
          {canChangeCurrency ? (
            <div>
              <p id={`${id}-currency`} className="mb-1.5 text-sm font-medium text-ink">Home currency</p>
              <Select
                aria-labelledby={`${id}-currency`}
                title="Home currency"
                value={currency}
                onChange={(v) => { setCurrency(v); setError(''); }}
                options={CURRENCY_OPTIONS}
              />
              <p className="mt-1 text-xs text-ink-muted">
                The currency you settle up in, usually the one at home, not the one you’re visiting. You can change it until expenses or cash are on the trip.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Home currency</p>
              <p className="text-sm text-ink">{trip.currency}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {isOwner && !closed && records && !records.empty
                  ? 'Balances and settle-up are worked out in this currency. It can’t change once expenses or cash are on the trip.'
                  : 'Balances and settle-up are worked out in this currency.'}
              </p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
          {!closed && (
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
            </button>
          )}
        </form>
      </section>

      {(isOwner || closed) && (
        <section aria-labelledby="close-trip" className="card space-y-2 p-4 sm:p-5">
          <h2 id="close-trip" className="text-base font-semibold text-ink">{closed ? 'Closed' : 'Close the trip'}</h2>
          <p className="text-[13px] text-ink-muted">
            {closedText(trip) ?? 'Once everything is in, close the trip so nothing changes by accident. Settle-up still works, and you can reopen it.'}
          </p>
          {isOwner && (closed ? (
            <button type="button" onClick={() => setClosed(false)} className="btn-outline">Reopen trip</button>
          ) : (
            <button type="button" onClick={() => setConfirmingClose(true)} className="btn-outline">Close trip</button>
          ))}
        </section>
      )}
      <ConfirmDialog
        open={confirmingClose}
        title="Close this trip?"
        message="No one can add, change or delete its expenses or cash until you reopen it. Settle-up still works."
        confirmLabel="Close trip"
        tone="primary"
        onConfirm={() => setClosed(true)}
        onCancel={() => setConfirmingClose(false)}
      />

      <MembersSection group={trip} currentUserUid={user.uid} />

      <SendInvite user={user} group={trip} />

      {isOwner && (
        <section aria-labelledby="delete-trip" className="card space-y-2 p-4 sm:p-5">
          <h2 id="delete-trip" className="text-base font-semibold text-ink">Delete the trip</h2>
          <p className="text-[13px] text-ink-muted">
            Removes the trip and everything on it, its expenses, cash and settle-up, for everyone on it. This can’t be undone.
          </p>
          {deleteError && <p role="alert" className="text-sm text-negative">{deleteError}</p>}
          <button type="button" disabled={deleting} onClick={() => setConfirmingDelete(true)} className="btn-outline text-negative">
            {deleting ? 'Deleting…' : 'Delete trip'}
          </button>
        </section>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${trip.name}?`}
        message="The trip and all its expenses, cash and settle-up are removed for everyone on it. This can’t be undone."
        confirmLabel="Delete trip"
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
