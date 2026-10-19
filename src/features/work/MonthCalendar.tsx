import { useMemo } from 'react';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { calendarCells, type CalendarCell, type CalendarStatus } from '../../lib/work/workCalendar';
import { dayLabel } from '../../lib/work/workFormat';

// One month as a Monday-first grid of days, each coloured by where it was worked.
// Today and earlier days are buttons; future days are disabled. A day's button
// carries its full description as its name, since its visible text is only the
// day number and the colour alone says nothing to a screen reader.

interface Props {
  /** 'YYYY-MM'. */
  month: string;
  days: WorkDayDoc[];
  settings: WorkSettingsDoc;
  clock: Clock;
  /** The day being edited, 'YYYY-MM-DD', or null for none. */
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const STATUS_TEXT: Record<Exclude<CalendarStatus, 'blank'>, string> = {
  home: 'home',
  office: 'office',
  leave: 'leave',
  missing: 'not filled in',
  empty: 'no record',
  future: 'no record',
};

const BASE =
  'relative grid aspect-square w-full place-items-center rounded-[9px] border text-sm tabular-nums transition ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

// Every status sets exactly one border colour. Tailwind writes same-property
// utilities in its CSS by name, not in class-attribute order, so a base
// `border-transparent` would beat the leave and missing colours and hide their
// dashed and dotted borders.
const STATUS_CLASS: Record<Exclude<CalendarStatus, 'blank'>, string> = {
  home: 'border-transparent bg-accent-soft font-bold text-accent-ink',
  office: 'border-transparent bg-recessed font-semibold text-ink',
  leave: 'border-dashed border-ink-faint font-semibold text-ink-muted',
  missing: 'border-dotted border-warning bg-warning-soft font-semibold text-warning',
  empty: 'border-transparent text-ink-muted hover:bg-recessed',
  future: 'border-transparent cursor-not-allowed text-ink-faint',
};

// Today is ringed in the accent and the selected day in ink. A day that is both
// keeps both: the accent ring sits inside, as the ring offset, with the ink ring around it.
function ringClass(today: boolean, selected: boolean): string {
  if (today && selected) return 'ring-2 ring-ink ring-offset-2 ring-offset-accent';
  if (selected) return 'ring-2 ring-ink';
  if (today) return 'ring-2 ring-accent';
  return '';
}

/** 'Thu 15 Oct, not filled in', with ', added later' and ', finish not confirmed' when they apply. */
function cellName(date: string, status: Exclude<CalendarStatus, 'blank'>, flags: Pick<CalendarCell, 'late' | 'unconfirmed'>): string {
  let name = `${dayLabel(date)}, ${STATUS_TEXT[status]}`;
  if (flags.late) name += ', added later';
  if (flags.unconfirmed) name += ', finish not confirmed';
  return name;
}

export default function MonthCalendar({ month, days, settings, clock, selectedDate, onSelect }: Props) {
  const cells = useMemo(() => calendarCells(month, days, settings, clock), [month, days, settings, clock]);

  return (
    <div>
      <div data-testid="calendar-weekdays" aria-hidden="true" className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((letter, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-ink-faint">
            {letter}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.date === null || cell.status === 'blank') return <div key={`blank-${i}`} aria-hidden="true" />;
          const { date, status } = cell;
          const selected = selectedDate === date;
          return (
            <button
              key={date}
              type="button"
              aria-label={cellName(date, status, cell)}
              aria-pressed={selected}
              aria-current={cell.today ? 'date' : undefined}
              disabled={!cell.selectable}
              onClick={() => onSelect(date)}
              className={`${BASE} ${STATUS_CLASS[status]} ${ringClass(cell.today, selected)}`}
            >
              {cell.day}
              {cell.late && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning" />}
              {cell.unconfirmed && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1 h-2 w-2 rounded-full border-[1.5px] border-warning"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
