import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { Calendar } from 'lucide-react';

const dayPickerClassNames = {
  root: 'relative p-2',
  months: 'flex',
  month: 'space-y-2',
  month_caption: 'flex items-center justify-center py-1 text-sm font-semibold text-slate-900',
  dropdowns: 'relative z-20 flex items-center gap-1',
  // The native <select> is stretched transparently over its label, so the
  // styled label is what shows while the OS picker handles the interaction.
  dropdown_root:
    'relative inline-flex rounded-lg transition hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-500/40',
  dropdown: 'absolute inset-0 w-full cursor-pointer appearance-none opacity-0',
  caption_label: 'flex items-center gap-1 px-2 py-1 text-sm font-semibold text-slate-900',
  nav: 'absolute inset-x-2 top-2 z-10 flex items-center justify-between',
  button_previous:
    'rounded-lg p-1 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700',
  button_next:
    'rounded-lg p-1 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700',
  chevron: 'h-4 w-4 fill-current',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'text-xs font-medium text-slate-400 uppercase',
  week: '',
  day: 'p-0 text-center',
  day_button:
    'flex h-9 w-9 items-center justify-center rounded-full text-sm text-slate-700 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
  selected: '[&>button]:bg-brand-600 [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-brand-600',
  today: '[&>button]:font-semibold [&>button]:text-brand-700',
  outside: '[&>button]:text-slate-300',
  disabled: '[&>button]:cursor-not-allowed [&>button]:text-slate-300 [&>button]:hover:bg-transparent',
};

// How far back / ahead the year dropdown reaches, widened to always include
// the selected date.
const YEARS_BACK = 10;
const YEARS_AHEAD = 5;

interface Props {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
}

export default function DatePicker({ id, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const thisYear = new Date().getFullYear();
  const selectedYear = selected?.getFullYear() ?? thisYear;
  const startMonth = new Date(Math.min(thisYear - YEARS_BACK, selectedYear), 0);
  const endMonth = new Date(Math.max(thisYear + YEARS_AHEAD, selectedYear), 11);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    }
    setOpen(false);
  }

  const label = selected ? format(selected, 'MMM d, yyyy') : 'Pick a date';

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-label={`Date: ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center justify-between text-left"
      >
        <span>{label}</span>
        <Calendar size={16} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-2xl border border-brand-100 bg-white/95 shadow-card-hover backdrop-blur-sm">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            classNames={dayPickerClassNames}
          />
        </div>
      )}
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
