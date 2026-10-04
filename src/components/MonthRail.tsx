import { useState } from 'react';
import { ChevronRight, CircleCheck } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import { useUIStore } from '../stores/uiStore';
import { useYearOverview } from '../hooks/useYearOverview';
import { railStatus } from '../lib/balance';
import { monthKey, monthRange, todayMonthKey } from '../lib/month';
import type { GroupDoc } from '../types/models';

interface Props {
  group: GroupDoc;
  viewerUid: string;
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TONE = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink-faint' } as const;

function YearHeader({ year, expanded, total, onToggle }: {
  year: string; expanded: boolean; total: number | null; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex w-full items-center justify-between px-2.5 pb-1.5 pt-2.5 text-xs font-semibold text-ink-faint hover:text-ink-muted"
    >
      <span className="flex items-center gap-1">
        <ChevronRight
          size={14}
          strokeWidth={1.75}
          aria-hidden="true"
          className={`motion-safe:transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        {year}
      </span>
      {total !== null && <span className="money">{Math.round(total / 100).toLocaleString('en-US')}</span>}
    </button>
  );
}

/** One year: its header, and its months when expanded. Fetches only while expanded. */
function YearSection({ group, viewerUid, year, months, expanded, onToggle }: Props & {
  year: string; months: string[]; expanded: boolean; onToggle: () => void;
}) {
  const { selectedMonth, setMonth } = useUIStore();
  const overview = useYearOverview(expanded ? group.id : null, year, group.memberUids);

  return (
    <>
      <YearHeader
        year={year}
        expanded={expanded}
        total={expanded && !overview.loading ? overview.total : null}
        onToggle={onToggle}
      />
      {expanded && months.map((m) => {
        const data = overview.months[m];
        const status = data ? railStatus(data.summary, viewerUid, group) : { text: 'Settled', tone: 'settled' as const };
        const selected = m === selectedMonth;
        return (
          <button
            key={m}
            type="button"
            aria-current={selected ? 'true' : undefined}
            onClick={() => setMonth(m)}
            className={`grid w-full gap-0.5 rounded-[10px] px-2.5 py-[9px] text-left transition-colors ${
              selected ? 'bg-surface ring-1 ring-line' : 'hover:bg-recessed'
            }`}
          >
            <span className={`flex justify-between text-sm text-ink ${selected ? 'font-semibold' : 'font-medium'}`}>
              {SHORT[Number(m.slice(5)) - 1]}
              {overview.loading ? (
                <Skeleton className="h-3.5 w-12" />
              ) : (
                <span className="money">{((data?.spent ?? 0) / 100).toFixed(2)}</span>
              )}
            </span>
            {overview.loading ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <span className={`flex items-center gap-1 text-xs ${TONE[status.tone]}`}>
                {status.tone === 'settled' && <CircleCheck size={12} strokeWidth={1.75} aria-hidden="true" />}
                {status.text}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

/** Desktop month list: year sections, each month with spend and balance status. */
export default function MonthRail({ group, viewerUid }: Props) {
  const { selectedMonth } = useUIStore();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const current = todayMonthKey();
  const createdAt = group.createdAt?.toDate?.();
  const start = createdAt ? monthKey(createdAt) : selectedMonth;
  const from = start < selectedMonth ? start : selectedMonth;
  const to = current > selectedMonth ? current : selectedMonth;

  const byYear = new Map<string, string[]>();
  for (const m of monthRange(from, to)) {
    const y = m.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), m]);
  }
  // Open by default: this year and the selected month's year. Older years
  // stay collapsed and unfetched until opened.
  const isOpen = (y: string) => toggled[y] ?? (y === current.slice(0, 4) || y === selectedMonth.slice(0, 4));
  const toggle = (y: string) => setToggled((t) => ({ ...t, [y]: !isOpen(y) }));

  return (
    <nav aria-label="Months" className="space-y-0.5">
      {[...byYear].map(([year, months]) => (
        <YearSection
          key={year}
          group={group}
          viewerUid={viewerUid}
          year={year}
          months={months}
          expanded={isOpen(year)}
          onToggle={() => toggle(year)}
        />
      ))}
    </nav>
  );
}
