import { useState, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Popover from '../../components/ui/Popover';

const dayPickerClassNames = {
  root: 'p-2',
  months: 'flex justify-center',
  month: 'space-y-1',
  month_grid: 'w-full border-collapse',
  weekday: 'pb-1 text-xs font-medium text-ink-muted',
  day: 'p-0 text-center',
  day_button:
    'flex h-10 w-10 items-center justify-center rounded-full text-sm text-ink transition hover:bg-recessed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:h-9 sm:w-9',
  selected: '[&>button]:bg-accent [&>button]:font-semibold [&>button]:text-on-accent [&>button]:hover:bg-accent',
  today: '[&>button]:font-semibold [&>button]:text-accent-ink',
  outside: '[&>button]:text-ink-faint',
  disabled: '[&>button]:cursor-not-allowed [&>button]:text-ink-faint [&>button]:hover:bg-transparent',
};

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), 'MMM'));
const navButton =
  'grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-recessed hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

// How far back / ahead the year dropdown reaches, widened to always include
// the selected date.
const YEARS_BACK = 10;
const YEARS_AHEAD = 5;

interface Props {
  id?: string;
  value: string; // YYYY-MM-DD
  /** What the field is, for its accessible name ("First day: May 10, 2027"); defaults to Date. */
  name?: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function DatePicker({ id, value, name = 'Date', onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  // The month shown, and whether the month/year grid replaces the days.
  const [view, setView] = useState<Date>(() => new Date());
  const [choosingMonth, setChoosingMonth] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const thisYear = new Date().getFullYear();
  const selectedYear = selected?.getFullYear() ?? thisYear;
  const firstYear = Math.min(thisYear - YEARS_BACK, selectedYear);
  const lastYear = Math.max(thisYear + YEARS_AHEAD, selectedYear);
  const startMonth = new Date(firstYear, 0);
  const endMonth = new Date(lastYear, 11);

  function toggle() {
    if (!open) {
      setView(selected ?? new Date());
      setChoosingMonth(false);
    }
    setOpen((o) => !o);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    }
    close();
  }

  const viewYear = view.getFullYear();
  const viewMonth = view.getMonth();
  const step = (months: number) => setView(new Date(viewYear, viewMonth + months, 1));
  const atStart = viewYear === firstYear && viewMonth === 0;
  const atEnd = viewYear === lastYear && viewMonth === 11;

  const label = selected ? format(selected, 'MMM d, yyyy') : 'Pick a date';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={`${name}: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="field flex w-full items-center justify-between text-left"
      >
        <span>{label}</span>
        <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
      <Popover open={open} onClose={close} anchorRef={triggerRef} title="Choose a date" minWidth={296}>
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            type="button"
            aria-label={choosingMonth ? 'Previous year' : 'Previous month'}
            disabled={choosingMonth ? viewYear <= firstYear : atStart}
            onClick={() => (choosingMonth ? step(-12) : step(-1))}
            className={navButton}
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Choose month and year"
            aria-expanded={choosingMonth}
            onClick={() => setChoosingMonth((c) => !c)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold text-ink transition hover:bg-recessed"
          >
            {choosingMonth ? viewYear : format(view, 'MMMM yyyy')}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={`text-ink-faint transition-transform ${choosingMonth ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label={choosingMonth ? 'Next year' : 'Next month'}
            disabled={choosingMonth ? viewYear >= lastYear : atEnd}
            onClick={() => (choosingMonth ? step(12) : step(1))}
            className={navButton}
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {choosingMonth ? (
          <div role="group" aria-label={`Months of ${viewYear}`} className="grid grid-cols-3 gap-1.5 p-3">
            {MONTH_NAMES.map((name, m) => {
              const on = m === viewMonth;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setView(new Date(viewYear, m, 1));
                    setChoosingMonth(false);
                  }}
                  className={`h-11 rounded-xl text-sm font-medium transition-colors ${
                    on ? 'bg-accent text-on-accent' : 'text-ink hover:bg-recessed'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : (
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={view}
            onMonthChange={setView}
            hideNavigation
            startMonth={startMonth}
            endMonth={endMonth}
            components={{ MonthCaption: () => <></> }}
            classNames={dayPickerClassNames}
          />
        )}
      </Popover>
      {error && <p className="mt-1 text-sm text-negative">{error}</p>}
    </div>
  );
}
