import { useState } from 'react';
import type { User } from 'firebase/auth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { useCategories } from '../../hooks/useCategories';
import { markSettlementPaid, undoSettlement } from '../../lib/settle';
import { paths } from '../../lib/paths';
import { formatMinor } from '../../lib/travel/currency';
import { expenseHomeTotal } from '../../lib/travel/tripExpense';
import {
  TRIP_SETTLEMENT_MONTH, tripBalanceCopy, tripBreakdown, tripMemberName, tripSummary, valueTrip,
} from '../../lib/travel/valueTrip';
import { settleWrite } from '../../lib/settleWrite';
import type { TripCash } from '../../lib/travel/cash';
import type { ExpenseDoc, GroupDoc, ItemDoc, SettlementDoc } from '../../types/models';

const TONE = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink-muted' } as const;
const SYNC_FAILED = "Couldn't sync a trip change. Check your connection and try again.";

interface Props {
  trip: GroupDoc;
  user: User;
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  settlements: SettlementDoc[];
  /** The trip's cash: its payments' values, and the kitties to settle and hand back. */
  cash?: Pick<TripCash, 'values' | 'kitties'> & Partial<Pick<TripCash, 'wallets'>>;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** A trip's balances and settle-up in its home currency, with what was spent by category and currency. */
export default function TripSummary({ trip, user, expenses, itemsByExpense, settlements, cash }: Props) {
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const home = trip.currency;
  const money = (amount: number) => formatMinor(amount, home);
  const nameOf = (uid: string) => tripMemberName(trip, uid, user.uid);
  const avatarName = (uid: string) => trip.members[uid]?.displayName || '?';

  const valuation = valueTrip(trip, expenses, itemsByExpense, cash?.values ?? {}, cash?.kitties ?? []);
  const kitties = (cash?.kitties ?? []).filter((k) => k.contributors.length > 0);
  const putIn = (uid: string) => kitties.flatMap((k) => {
    const c = k.contributors.find((x) => x.uid === uid);
    return c ? [`Put in the kitty ${money(c.home)}, back ${formatMinor(c.handBack, k.currency)}`] : [];
  });
  const summary = tripSummary(valuation, settlements);
  const { all: categories } = useCategories(trip.id);
  const breakdown = tripBreakdown(valuation, expenses, home, Object.fromEntries(categories.map((c) => [c.id, c.name])));
  const paid = settlements.filter((s) => s.paid);
  const approx = valuation.estimated.length > 0 ? '≈ ' : '';

  async function run(action: () => Promise<void>) {
    setActionError('');
    setPending(true);
    try {
      await settleWrite(action(), SYNC_FAILED);
    } catch {
      setActionError('That didn’t save. Try again.');
    } finally {
      setPending(false);
    }
  }

  // A paid settlement keeps the page useful after its expenses are deleted: it can be undone or paid back.
  if (expenses.length === 0 && paid.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-ink-muted">No expenses yet, so nothing to settle.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {valuation.estimated.length > 0 && (
        <section aria-label="Estimated rates" className="card border-warning/40 bg-warning-soft p-4">
          <p className="flex items-start gap-2 text-sm text-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              {`${valuation.estimated.length} card ${plural(valuation.estimated.length, 'payment is', 'payments are')} still at an estimated rate.`}{' '}
              Balances change once you enter what the card was charged.
            </span>
          </p>
          <ul className="mt-2 space-y-1 pl-6">
            {valuation.estimated.map((e) => (
              <li key={e.id}>
                <Link to={paths.tripExpense(trip.id, e.id)} className="text-[13px] font-medium text-accent-ink hover:underline">
                  {`${e.shopName?.trim() || itemsByExpense[e.id]?.[0]?.name || 'Expense'} · ≈ ${money(expenseHomeTotal(e, home) ?? 0)}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {valuation.unvalued.length > 0 && (
        <p className="card p-4 text-sm text-ink-muted">
          {`${valuation.unvalued.length} cash ${plural(valuation.unvalued.length, 'payment isn’t', 'payments aren’t')} in the balances yet: add the cash that was bought on the Cash page.`}
        </p>
      )}

      <section aria-labelledby="settle-up" className="card p-5">
        <h2 id="settle-up" className="mb-3 text-base font-semibold text-ink">Settle up</h2>
        {summary.transactions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-accent-ink">
            <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            All settled
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {summary.transactions.map((txn) => (
              <li key={`${txn.fromUid}-${txn.toUid}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex items-center">
                  <Avatar name={avatarName(txn.fromUid)} tone={txn.fromUid === user.uid ? 'me' : 'them'} />
                  <span className="-ml-2">
                    <Avatar name={avatarName(txn.toUid)} tone={txn.toUid === user.uid ? 'me' : 'them'} ring />
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">{`${nameOf(txn.fromUid)} → ${nameOf(txn.toUid)}`}</span>
                <span className="money text-sm font-semibold text-ink">{money(txn.amount)}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(() => markSettlementPaid(trip.id, TRIP_SETTLEMENT_MONTH, txn, user.uid, settlements))}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        )}
        {paid.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {paid.map((s) => {
              const paidAt = s.paidAt?.toDate?.();
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm text-ink-muted">
                  <span className="min-w-0 flex-1">
                    {`${nameOf(s.fromUid)} → ${nameOf(s.toUid)} `}
                    <span className="money">{money(s.amount)}</span>
                  </span>
                  <span className="text-xs">{paidAt ? `Paid ${format(paidAt, 'd MMM')}` : 'Paid'}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(() => undoSettlement(trip.id, s.id))}
                    className="btn-ghost h-8 px-2.5 text-xs"
                  >
                    Undo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {actionError && <p role="alert" className="mt-2 text-sm text-negative">{actionError}</p>}
      </section>

      {kitties.length > 0 && (
        <section aria-labelledby="kitty" className="card p-5">
          <h2 id="kitty" className="mb-2 text-base font-semibold text-ink">Kitty</h2>
          {kitties.map((k) => {
            const { currency } = k;
            const back = k.contributors.filter((c) => c.handBack > 0);
            let text: string;
            if (k.left.foreign > 0) {
              text = `Hand back the ${formatMinor(k.left.foreign, currency)} left: ${back
                .map((c) => `${c.uid === user.uid ? 'you' : tripMemberName(trip, c.uid, user.uid)} ${formatMinor(c.handBack, currency)}`)
                .join(', ')}.`;
            } else if (k.left.foreign < 0) {
              text = `The ${currency} kitty paid out ${formatMinor(-k.left.foreign, currency)} more than was put in; whoever handed that cash over is credited for it.`;
            } else {
              text = `The ${currency} kitty is used up.`;
            }
            return <p key={k.walletId} className="text-sm text-ink">{text}</p>;
          })}
          <p className="mt-1 text-xs text-ink-muted">Each person gets back their share of what's left, in proportion to the cash they put in, and bears the kitty's spending in proportion to what their cash cost. The balances already count it.</p>
        </section>
      )}

      <section aria-labelledby="per-person" className="card p-5">
        <h2 id="per-person" className="mb-3 text-base font-semibold text-ink">Per person</h2>
        <ul className="divide-y divide-line">
          {valuation.people.map((uid) => {
            const copy = tripBalanceCopy(summary.balance[uid] ?? 0, uid === user.uid, home);
            const name = nameOf(uid);
            return (
              <li key={uid} aria-label={name} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar name={avatarName(uid)} tone={uid === user.uid ? 'me' : 'them'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{name}</span>
                    <span className={`font-semibold ${TONE[copy.tone]}`}>
                      {copy.verb}
                      {copy.amount && <> <span className="money">{copy.amount}</span></>}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {[`Paid for shared ${money(summary.paidShared[uid] ?? 0)}`, `Share ${money(summary.shareOf[uid] ?? 0)}`, ...putIn(uid)].join(' · ')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="spending" className="card p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="spending" className="text-base font-semibold text-ink">Spending</h2>
          <span className="text-base font-semibold tabular-nums text-ink">{`${approx}${money(breakdown.spent)}`}</span>
        </div>
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">By category</h3>
        <ul className="mb-3 divide-y divide-line">
          {breakdown.byCategory.map((c) => (
            <li key={c.name} aria-label={c.name} className="flex justify-between gap-3 py-1.5 text-sm">
              <span className="text-ink">{c.name}</span>
              <span className="tabular-nums text-ink">{money(c.amount)}</span>
            </li>
          ))}
        </ul>
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Paid in</h3>
        <ul className="divide-y divide-line">
          {breakdown.byCurrency.map((c) => (
            <li key={c.currency} aria-label={`Paid in ${c.currency}`} className="flex justify-between gap-3 py-1.5 text-sm">
              <span className="text-ink">{c.currency}</span>
              <span className="tabular-nums text-ink">{formatMinor(c.amount, c.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
