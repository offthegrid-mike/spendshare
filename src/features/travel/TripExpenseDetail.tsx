import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { memberName } from '../../lib/balance';
import { paths } from '../../lib/paths';
import { formatMinor, minorDigits, toMinor } from '../../lib/travel/currency';
import { expenseDay, expenseHomeTotal, isEstimated } from '../../lib/travel/tripExpense';
import { useUIStore } from '../../stores/uiStore';
import { deleteTripExpense, recordCharge } from './tripWrite';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Props {
  trip: GroupDoc;
  user: User;
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
}

/** A rate for reading: up to four significant digits ("99", "96.71", "0.6154"). */
function readableRate(rate: number): string {
  return String(Number(rate.toPrecision(4)));
}

function names(trip: GroupDoc, uids: string[], viewerUid: string): string {
  const list = uids.map((uid) => (uid === viewerUid ? 'you' : memberName(trip, uid)));
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function ChargeForm({ trip, user, expense, onDone, onCancel }: {
  trip: GroupDoc; user: User; expense: ExpenseDoc; onDone: () => void; onCancel?: () => void;
}) {
  const id = useId();
  const home = trip.currency;
  const charged = expense.paidWith?.kind === 'card' ? expense.paidWith.homeTotal : undefined;
  const digits = minorDigits(home);
  const [value, setValue] = useState(charged !== undefined ? (charged / 10 ** digits).toFixed(digits) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = toMinor(value, home);
    if (!(amount > 0)) {
      setError(`Enter the amount in ${home}, as on your statement.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await recordCharge(trip.id, expense, amount, home, user.uid);
      onDone();
    } catch {
      setError("Couldn't save the amount charged. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label htmlFor={`${id}-charged`} className="block text-sm font-medium text-ink">{`Amount charged (${home})`}</label>
      <div className="flex gap-2">
        <input
          id={`${id}-charged`}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="As on your statement"
          className="field min-w-0 flex-1"
        />
        <LoadingButton type="submit" loading={saving} loadingText="Saving…" className="btn-primary shrink-0">
          Save amount charged
        </LoadingButton>
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-[13px] font-medium text-ink-muted hover:text-ink">
          Cancel
        </button>
      )}
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
    </form>
  );
}

/** One trip expense: its items and sharers, the rate it was valued at, and entering what the card was charged. */
export default function TripExpenseDetail({ trip, user, expenses, itemsByExpense }: Props) {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const [changingCharge, setChangingCharge] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const expense = expenses.find((e) => e.id === expenseId);

  if (!expense) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-ink">Expense not found</p>
        <p className="mt-1 text-[13px] text-ink-muted">It may have been deleted.</p>
        <Link to={paths.trip(trip.id)} className="btn-outline mt-4">Back to the trip</Link>
      </div>
    );
  }

  const home = trip.currency;
  const currency = expense.currency ?? home;
  const foreign = currency !== home;
  const items = itemsByExpense[expense.id] ?? [];
  const paid = expense.paidWith;
  const homeTotal = expenseHomeTotal(expense, home);
  const payer = expense.payerUid === user.uid ? 'You' : memberName(trip, expense.payerUid);
  const showChargeForm = foreign && paid?.kind === 'card' && (isEstimated(expense, home) || changingCharge);

  function handleDelete() {
    setConfirming(false);
    // Leave at once: the live list drops the expense before the server confirms,
    // which would otherwise flash "Expense not found" here. A failure comes back as a notice.
    const deleting = deleteTripExpense(trip.id, expense!.id, items.map((it) => it.id));
    navigate(paths.trip(trip.id), { replace: true });
    deleting.catch(() => useUIStore.getState().showNotice({ message: "Couldn't delete the expense. Try again." }));
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="card space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{expense.shopName?.trim() || items[0]?.name || 'Expense'}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">{`${payer} paid · ${format(parseISO(expenseDay(expense)), 'EEE d MMM yyyy')}`}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">{formatMinor(expense.total, currency)}</p>
          {foreign && paid?.kind === 'card' && homeTotal !== null && (
            <p className="text-[13px] tabular-nums text-ink-muted">
              {paid.rateStatus === 'actual' && paid.homeTotal !== undefined
                ? `Charged ${formatMinor(paid.homeTotal, home)} (1 ${home} = ${readableRate(paid.rate)} ${currency})`
                : `≈ ${formatMinor(homeTotal, home)} at 1 ${home} = ${readableRate(paid.rate)} ${currency} (estimated)`}
            </p>
          )}
        </div>
        {showChargeForm ? (
          <ChargeForm
            trip={trip}
            user={user}
            expense={expense}
            onDone={() => setChangingCharge(false)}
            onCancel={changingCharge ? () => setChangingCharge(false) : undefined}
          />
        ) : (
          foreign && paid?.kind === 'card' && (
            <button type="button" onClick={() => setChangingCharge(true)} className="text-[13px] font-medium text-accent-ink hover:underline">
              Change
            </button>
          )
        )}
      </section>

      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{it.name}</span>
              <span className="block text-xs text-ink-muted">
                {it.shared
                  ? `Shared by ${names(trip, it.sharedWith ?? trip.memberUids, user.uid)}`
                  : `Personal${it.category ? ` · ${it.category}` : ''}`}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-ink">{formatMinor(it.amount, currency)}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Link to={paths.editTripExpense(trip.id, expense.id)} className="btn-outline">
          <Pencil size={14} aria-hidden="true" />
          Edit
        </Link>
        <button type="button" onClick={() => setConfirming(true)} className="btn-ghost border border-line text-negative">
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete this expense?"
        message="It comes off everyone's balance. This can't be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
