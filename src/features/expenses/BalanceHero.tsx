import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import TugBar from './TugBar';
import { computeSummary, type SummaryItem, type Txn } from '../../lib/settlement';
import { describeBalance, memberName } from '../../lib/balance';
import { formatMoney, splitMoney } from '../../lib/money';
import { monthName } from '../../lib/month';
import { markSettlementPaid, undoSettlement } from '../../lib/settle';
import { paths } from '../../lib/paths';
import type { GroupDoc, SettlementDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  viewerUid: string;
  /** 'YYYY-MM' */
  month: string;
  items: SummaryItem[];
  settlements: SettlementDoc[];
}

const TONE_CLASS = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink' } as const;

function latestPaid(settlements: SettlementDoc[]): SettlementDoc | undefined {
  // A just-marked settlement has no paidAt yet: treat it as the newest.
  const time = (s: SettlementDoc) => s.paidAt?.toMillis?.() ?? Number.POSITIVE_INFINITY;
  return settlements.filter((s) => s.paid).sort((a, b) => time(b) - time(a))[0];
}

/** The Expenses home's headline: who owes whom this month, and Settle up. */
export default function BalanceHero({ group, viewerUid, month, items, settlements }: Props) {
  const [confirming, setConfirming] = useState<Txn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = group.currency;
  const name = monthName(month);
  const summary = computeSummary(group.memberUids, items, settlements);
  const empty = items.length === 0;
  const balance = describeBalance(summary, viewerUid, group, name);
  const money = splitMoney(balance.amount, currency);
  const isPair = group.memberUids.length === 2;
  // Nothing to settle in a month without expenses, even if a settlement is
  // left over from deleted ones (that one can still be undone).
  const pending = empty ? undefined : summary.transactions[0];
  const undoable = pending ? undefined : latestPaid(settlements);
  const spent = items.reduce((sum, it) => sum + Math.round(it.amount), 0);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("Couldn't update the settlement. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmText(txn: Txn): string {
    const amount = formatMoney(txn.amount, currency);
    return txn.fromUid === viewerUid
      ? `Mark your ${amount} to ${memberName(group, txn.toUid)} as paid?`
      : `Mark ${memberName(group, txn.fromUid)}'s ${amount} as paid?`;
  }

  let action = null;
  if (pending && isPair) {
    action = (
      <button type="button" className="btn-primary" disabled={busy} onClick={() => setConfirming(pending)}>
        Settle up
      </button>
    );
  } else if (pending) {
    action = <Link to={paths.summary} className="btn-primary">Settle up</Link>;
  } else if (undoable) {
    action = (
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={() => void run(() => undoSettlement(group.id, undoable.id))}
      >
        <Undo2 size={16} strokeWidth={1.75} aria-hidden="true" />
        Undo
      </button>
    );
  }

  return (
    <section aria-label="Balance" className="pb-1">
      <div className="grid items-center gap-x-7 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div>
          <p className="text-[13px] text-ink-muted">{empty ? 'Nothing to settle' : balance.label}</p>
          {!empty && (
            <p className={`money text-[40px] font-semibold leading-tight tracking-[-0.04em] ${TONE_CLASS[balance.tone]}`}>
              <span className="mr-0.5 text-[19px] tracking-normal text-ink-muted">{money.symbol}</span>
              {money.amount}
            </p>
          )}
        </div>
        <div>{!empty && <TugBar summary={summary} viewerUid={viewerUid} group={group} />}</div>
        {action && <div className="justify-self-start sm:justify-self-end">{action}</div>}
      </div>
      {!empty && (
        <p className="mt-3 text-[13px] text-ink-muted">
          Spent <span className="money text-ink">{formatMoney(spent, currency)}</span> in {name},{' '}
          <span className="money text-ink">{formatMoney(summary.sharedTotal, currency)}</span> shared, your share{' '}
          <span className="money text-ink">{formatMoney(summary.shareOf[viewerUid] ?? 0, currency)}</span>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      <ConfirmDialog
        open={confirming !== null}
        title="Settle up"
        message={confirming ? confirmText(confirming) : ''}
        confirmLabel="Mark paid"
        tone="primary"
        confirmDisabled={busy}
        onConfirm={() => {
          const txn = confirming;
          setConfirming(null);
          if (txn) void run(() => markSettlementPaid(group.id, month, txn, viewerUid, settlements));
        }}
        onCancel={() => setConfirming(null)}
      />
    </section>
  );
}
