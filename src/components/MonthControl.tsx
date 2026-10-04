import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { formatMonthLabel, monthRange, nextMonthKey, prevMonthKey, todayMonthKey } from '../lib/month';

interface Props {
  /** The group's first month ('YYYY-MM'); null while unknown. */
  startMonth?: string | null;
}

const stepButton =
  'grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-recessed hover:text-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export default function MonthControl({ startMonth = null }: Props) {
  const { selectedMonth, setMonth } = useUIStore();
  const currentMonth = todayMonthKey();

  // Always include the selected month, even if it falls outside the group's
  // lifetime (e.g. an expense dated before the group was created).
  const from = startMonth && startMonth < selectedMonth ? startMonth : selectedMonth;
  const to = currentMonth > selectedMonth ? currentMonth : selectedMonth;
  const months = monthRange(from, to);

  return (
    <div className="flex items-center rounded-full border border-line bg-surface p-0.5">
      <button
        type="button"
        onClick={() => setMonth(prevMonthKey(selectedMonth))}
        aria-label="Previous"
        className={stepButton}
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span className="relative flex items-center gap-1 rounded-full px-1.5 text-sm font-semibold text-ink focus-within:ring-2 focus-within:ring-accent/40">
        {formatMonthLabel(selectedMonth)}
        <ChevronDown size={14} strokeWidth={1.75} className="text-ink-faint" aria-hidden="true" />
        <select
          aria-label="Month"
          value={selectedMonth}
          onChange={(e) => setMonth(e.target.value)}
          className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        >
          {months.map((m) => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>
      </span>
      <button
        type="button"
        onClick={() => setMonth(nextMonthKey(selectedMonth))}
        disabled={selectedMonth >= currentMonth}
        aria-label="Next"
        className={stepButton}
      >
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
