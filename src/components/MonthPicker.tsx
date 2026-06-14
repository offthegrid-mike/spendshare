import { useUIStore } from '../stores/uiStore';

// Pure string helpers — no `new Date()` so tests can safely spy on the Date constructor.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseYM(ym: string): { year: number; month: number } {
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
}

function prevMonthKey(ym: string): string {
  let { year, month } = parseYM(ym);
  month -= 1;
  if (month < 1) { month = 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function nextMonthKey(ym: string): string {
  let { year, month } = parseYM(ym);
  month += 1;
  if (month > 12) { month = 1; year += 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatLabel(ym: string): string {
  const { year, month } = parseYM(ym);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Returns the current month as 'YYYY-MM' using only Intl (avoids `new Date()`). */
function todayMonthKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
  }).format(Date.now()).slice(0, 7);
}

export default function MonthPicker() {
  const { selectedMonth, setMonth } = useUIStore();
  const currentMonth = todayMonthKey();
  const isCurrentMonth = selectedMonth === currentMonth;

  const label = formatLabel(selectedMonth);

  function goToPrev() {
    setMonth(prevMonthKey(selectedMonth));
  }

  function goToNext() {
    setMonth(nextMonthKey(selectedMonth));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={goToPrev}
        aria-label="Previous"
        className="rounded-lg px-2 py-1 text-sm text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        ←
      </button>
      <span className="w-28 text-center text-sm font-semibold text-white">{label}</span>
      <button
        type="button"
        onClick={goToNext}
        disabled={isCurrentMonth}
        aria-label="Next"
        className="rounded-lg px-2 py-1 text-sm text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}
