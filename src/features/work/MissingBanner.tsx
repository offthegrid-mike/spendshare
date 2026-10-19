import type { ReactNode } from 'react';
import { CalendarClock, CalendarX } from 'lucide-react';
import { dayLabel } from '../../lib/work/workFormat';

// A nudge above the calendar for weekdays with no record and Home days whose
// finish is still to be confirmed. Each shows its first few days as chips that
// open the day; any beyond that are only counted, as the calendar has the rest.

interface Props {
  /** Past working days with no record, 'YYYY-MM-DD'. */
  missing: string[];
  /** Home days whose finish has passed without being confirmed. */
  toConfirm: string[];
  onPick: (date: string) => void;
}

const MAX_CHIPS = 3;

interface GroupProps {
  icon: ReactNode;
  text: string;
  dates: string[];
  onPick: (date: string) => void;
}

function Group({ icon, text, dates, onPick }: GroupProps) {
  const more = dates.length - MAX_CHIPS;
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{text}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {dates.slice(0, MAX_CHIPS).map((date) => (
          <button
            key={date}
            type="button"
            onClick={() => onPick(date)}
            className="rounded-full border border-warning/40 bg-surface px-2.5 py-1 text-xs font-semibold text-warning transition hover:bg-recessed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {dayLabel(date)}
          </button>
        ))}
        {more > 0 && <span className="text-xs font-medium">+{more} more</span>}
      </div>
    </div>
  );
}

export default function MissingBanner({ missing, toConfirm, onPick }: Props) {
  if (missing.length === 0 && toConfirm.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-warning-soft p-3.5 text-warning">
      {missing.length > 0 && (
        <Group
          icon={<CalendarX size={16} strokeWidth={1.75} aria-hidden="true" />}
          text={`${missing.length} ${missing.length === 1 ? 'weekday' : 'weekdays'} not filled in`}
          dates={missing}
          onPick={onPick}
        />
      )}
      {toConfirm.length > 0 && (
        <Group
          icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />}
          text={`${toConfirm.length} ${toConfirm.length === 1 ? 'day' : 'days'} to confirm`}
          dates={toConfirm}
          onPick={onPick}
        />
      )}
    </div>
  );
}
