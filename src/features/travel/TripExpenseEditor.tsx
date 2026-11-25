import { useId, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Plus, X } from 'lucide-react';
import Checkbox from '../../components/ui/Checkbox';
import LoadingButton from '../../components/LoadingButton';
import Select from '../../components/ui/Select';
import { useCategories } from '../../hooks/useCategories';
import { useWorkClock } from '../../hooks/useWorkClock';
import { currencyOptions, formatMinor, minorDigits, toMinor } from '../../lib/travel/currency';
import {
  buildTripExpense, expenseDay, lastRates, parseRate, toHome, type TripExpenseDraft, type TripItemDraft,
} from '../../lib/travel/tripExpense';
import { tripStatus } from '../../lib/travel/trips';
import DatePicker from '../expenses/DatePicker';
import PayerPicker from '../expenses/PayerPicker';
import SharerChips from './SharerChips';
import { saveTripExpense } from './tripWrite';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

const CURRENCY_OPTIONS = currencyOptions().map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

interface Props {
  trip: GroupDoc;
  user: User;
  /** The trip's expenses, for the last currency and rate used. */
  expenses: ExpenseDoc[];
  existing?: { expense: ExpenseDoc; items: ItemDoc[] };
  onSaved: (expenseId: string) => void;
}

/** A rate as typed: up to six significant digits, so a rate worked out from a charge stays readable. */
function rateText(rate: number | undefined): string {
  return rate === undefined ? '' : String(Number(rate.toPrecision(6)));
}

function amountText(amount: number, currency: string): string {
  const digits = minorDigits(currency);
  return (amount / 10 ** digits).toFixed(digits);
}

/** Today during the trip; otherwise its first day before it starts, or its last day after it ends. */
function defaultDay(trip: GroupDoc, today: string): string {
  if (!trip.trip) return today;
  const status = tripStatus(trip.trip, today);
  if (status === 'upcoming') return trip.trip.startDate;
  if (status === 'past') return trip.trip.endDate;
  return today;
}

function initialDraft(
  trip: GroupDoc, viewerUid: string, today: string, expenses: ExpenseDoc[], firstCategory: string,
  existing?: Props['existing'],
): TripExpenseDraft {
  const everyone = trip.memberUids;
  if (existing) {
    const { expense, items } = existing;
    const currency = expense.currency ?? trip.currency;
    return {
      date: expenseDay(expense),
      shopName: expense.shopName ?? '',
      payerUid: expense.payerUid,
      currency,
      rate: expense.paidWith?.kind === 'card' && currency !== trip.currency ? rateText(expense.paidWith.rate) : '',
      items: items.map((it) => ({
        name: it.name,
        categoryId: it.categoryId,
        amount: amountText(it.amount, currency),
        shared: it.shared,
        sharedWith: it.sharedWith ?? everyone,
      })),
    };
  }
  const last = lastRates(expenses, trip.currency);
  return {
    date: defaultDay(trip, today),
    shopName: '',
    payerUid: viewerUid,
    currency: last.currency,
    rate: rateText(last.rates[last.currency]),
    items: [blankItem(firstCategory, everyone)],
  };
}

function blankItem(categoryId: string, sharedWith: string[]): TripItemDraft {
  return { name: '', categoryId, amount: '', shared: true, sharedWith };
}

/** Adds or edits a trip expense in any currency, choosing who shares each item. */
export default function TripExpenseEditor({ trip, user, expenses, existing, onSaved }: Props) {
  const id = useId();
  const { today } = useWorkClock();
  const { active: categories } = useCategories(trip.id);
  const firstCategory = categories[0]?.id ?? '';
  const [draft, setDraft] = useState<TripExpenseDraft>(() =>
    initialDraft(trip, user.uid, today, expenses, firstCategory, existing),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const home = trip.currency;
  const foreign = draft.currency !== home;

  function patch(p: Partial<TripExpenseDraft>) {
    setDraft((d) => ({ ...d, ...p }));
    setError('');
  }
  function patchItem(index: number, p: Partial<TripItemDraft>) {
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...p } : it)) }));
    setError('');
  }

  function changeCurrency(currency: string) {
    // Each currency keeps its own last rate.
    patch({ currency, rate: rateText(lastRates(expenses, home).rates[currency]) });
  }

  // Categories may still be loading when a new expense opens; fill the first in as they arrive.
  const items = draft.items.map((it) => (it.categoryId || !firstCategory ? it : { ...it, categoryId: firstCategory }));

  const totals = useMemo(() => {
    const total = items.reduce((s, it) => {
      const n = toMinor(it.amount || '0', draft.currency);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
    const rate = foreign ? parseRate(draft.rate) : 1;
    return { total, home: rate > 0 ? toHome(total, draft.currency, home, rate) : null };
  }, [items, draft.currency, draft.rate, foreign, home]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = buildTripExpense({ ...draft, items }, home);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const expenseId = await saveTripExpense({
        tripId: trip.id,
        uid: user.uid,
        home,
        built: result.value,
        categories: Object.fromEntries(categories.map((c) => [c.id, c.name])),
        existing,
      });
      onSaved(expenseId);
    } catch {
      setError("Couldn't save the expense. Try again.");
      setSaving(false);
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="card space-y-4 p-4 sm:p-5">
        <div>
          <label htmlFor={`${id}-where`} className="mb-1 block text-sm font-medium text-ink">Where</label>
          <input
            id={`${id}-where`}
            type="text"
            value={draft.shopName}
            onChange={(e) => patch({ shopName: e.target.value })}
            placeholder="Shop, restaurant or place"
            autoComplete="off"
            className="field"
          />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="mb-1 block text-sm font-medium text-ink">Date</label>
          <DatePicker id={`${id}-date`} value={draft.date} onChange={(date) => patch({ date })} />
        </div>
        <PayerPicker group={trip} viewerUid={user.uid} value={draft.payerUid} onChange={(payerUid) => patch({ payerUid })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p id={`${id}-currency`} className="mb-1 text-sm font-medium text-ink">Currency</p>
            <Select
              aria-labelledby={`${id}-currency`}
              title="Currency"
              value={draft.currency}
              onChange={changeCurrency}
              options={CURRENCY_OPTIONS}
            />
          </div>
          {foreign && (
            <div>
              <label htmlFor={`${id}-rate`} className="mb-1 block text-sm font-medium text-ink">Exchange rate</label>
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="shrink-0">{`1 ${home} =`}</span>
                <input
                  id={`${id}-rate`}
                  type="text"
                  inputMode="decimal"
                  value={draft.rate}
                  onChange={(e) => patch({ rate: e.target.value })}
                  className="field"
                />
                <span className="shrink-0">{draft.currency}</span>
              </div>
            </div>
          )}
        </div>
        {foreign && (
          <p className="text-xs text-ink-muted">
            Paid by card at an estimated rate. Once you see what the card was charged, enter it on the expense.
          </p>
        )}
      </div>

      {items.map((it, i) => {
        const n = i + 1;
        return (
          <div key={i} role="group" aria-label={`Item ${n}`} className="card space-y-3 p-4">
            <div className="flex items-start gap-2">
              <input
                type="text"
                aria-label={`Item ${n} name`}
                value={it.name}
                onChange={(e) => patchItem(i, { name: e.target.value })}
                placeholder="What was it?"
                autoComplete="off"
                className="field min-w-0 flex-1"
              />
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Item ${n} amount`}
                value={it.amount}
                onChange={(e) => patchItem(i, { amount: e.target.value })}
                placeholder="0"
                className="field w-28 text-right tabular-nums"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove item ${n}`}
                  onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[10rem] flex-1">
                <Select
                  aria-label={`Item ${n} category`}
                  title="Category"
                  value={it.categoryId}
                  onChange={(categoryId) => patchItem(i, { categoryId })}
                  options={categoryOptions}
                />
              </div>
              <Checkbox checked={it.shared} onChange={(e) => patchItem(i, { shared: e.target.checked })}>
                Shared
              </Checkbox>
            </div>
            {it.shared ? (
              <SharerChips
                trip={trip}
                viewerUid={user.uid}
                label={`Item ${n} shared with`}
                value={it.sharedWith}
                onChange={(sharedWith) => patchItem(i, { sharedWith })}
              />
            ) : (
              <p className="text-xs text-ink-muted">Personal: only the payer pays for it.</p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setDraft((d) => ({
          ...d,
          // A new item starts with the same people as the one before it.
          items: [...d.items, blankItem(firstCategory, d.items[d.items.length - 1]?.sharedWith ?? trip.memberUids)],
        }))}
        className="btn-outline"
      >
        <Plus size={14} aria-hidden="true" />
        Add item
      </button>

      <div className="card flex items-baseline justify-between gap-3 p-4">
        <span className="text-sm font-medium text-ink">Total</span>
        <span className="text-right">
          <span className="block text-base font-semibold tabular-nums text-ink">{formatMinor(totals.total, draft.currency)}</span>
          {foreign && totals.home !== null && (
            <span className="block text-xs tabular-nums text-ink-muted">{`≈ ${formatMinor(totals.home, home)}`}</span>
          )}
        </span>
      </div>

      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <LoadingButton type="submit" loading={saving} loadingText="Saving…" className="btn-primary h-11 w-full">
        {existing ? 'Save changes' : 'Save expense'}
      </LoadingButton>
    </form>
  );
}
