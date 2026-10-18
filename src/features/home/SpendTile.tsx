import { Link } from 'react-router-dom';
import { ChevronRight, ReceiptText } from 'lucide-react';
import Skeleton from '../../components/ui/Skeleton';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { formatMoney } from '../../lib/money';
import { todayMonthKey } from '../../lib/month';
import { spendTileFigures } from '../../lib/homeSpend';
import { paths } from '../../lib/paths';
import type { GroupDoc } from '../../types/models';

interface Props {
  groups: GroupDoc[];
  /** The selected household; null while it loads. */
  group: GroupDoc | null;
  viewerUid: string;
}

// The same tones as the balance hero on the Expenses screen.
const TONE_CLASS = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink' } as const;

const LINE = 'flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px] text-ink-muted';

/** Home's SpendShare tile: this month's spending and the viewer's balance, with a way into SpendShare. */
export default function SpendTile({ groups, group, viewerUid }: Props) {
  const month = todayMonthKey();
  const gid = group?.id ?? null;
  const { itemsByExpense, loading, itemsLoading } = useMonthExpenses(gid, month);
  const { settlements, loading: settlementsLoading } = useSettlements(gid, month);

  const ready = group !== null && !loading && !itemsLoading && !settlementsLoading;
  const figures = ready
    ? spendTileFigures(group, viewerUid, Object.values(itemsByExpense).flat(), settlements, month)
    : null;

  let body;
  if (groups.length === 0) {
    body = (
      <div className="border-t border-line pt-3">
        <Link to={paths.spend} className="btn-outline">
          Create a household
        </Link>
      </div>
    );
  } else if (group && figures) {
    body = (
      <div>
        <p className={LINE}>
          <span>
            {group.name} · {figures.monthLabel}
          </span>
          <span className="money text-ink">{formatMoney(figures.spent, group.currency)}</span>
        </p>
        <p className={LINE}>
          <span>{figures.balanceLabel}</span>
          {!figures.empty && (
            <span className={`money ${TONE_CLASS[figures.tone]}`}>{formatMoney(figures.balanceAmount, group.currency)}</span>
          )}
        </p>
      </div>
    );
  } else {
    body = (
      <div role="status" aria-label="Loading figures">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section aria-label="SpendShare" className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={paths.spend}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
            <ReceiptText size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-ink">SpendShare</h2>
          <ChevronRight size={18} strokeWidth={1.75} className="ml-auto text-ink-faint" aria-hidden="true" />
        </Link>
        {groups.length > 0 && (
          <Link to={paths.newExpense} className="btn-outline hidden lg:inline-flex">
            Add expense
          </Link>
        )}
      </div>
      {body}
    </section>
  );
}
