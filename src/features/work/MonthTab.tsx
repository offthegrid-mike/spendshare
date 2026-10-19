import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Skeleton from '../../components/ui/Skeleton';
import { useWorkDays } from '../../hooks/useWorkDays';
import { formatMonthLabel, nextMonthKey, prevMonthKey } from '../../lib/month';
import { incomeYearOf } from '../../lib/work/workDates';
import { dayLabel } from '../../lib/work/workFormat';
import { formatHours } from '../../lib/work/workTime';
import type { WorkDayDoc, WorkDayType } from '../../types/models';
import DayEditor from './DayEditor';
import DaySheet from './DaySheet';
import MonthCalendar from './MonthCalendar';
import { useWork } from './WorkContext';

// The Month tab: one month at a time, back as far as the user likes and no
// further forward than the current month, with the days recorded in it listed
// below. A day picked from the calendar or the list opens in a DaySheet; the
// editor in it is keyed by the date so each pick starts afresh.

const TYPE_TEXT: Record<WorkDayType, string> = { home: 'Home', office: 'Office', leave: 'Leave' };

const NAV_BUTTON = 'btn-ghost h-9 w-9 shrink-0 px-0';

/** Stands in for the calendar while the days load: a weekday row over five weeks. */
function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-1">
      <Skeleton className="mb-1 h-3 w-full" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-[9px]" />
        ))}
      </div>
    </div>
  );
}

/** 'Wed 14 Oct, Home, 7.75 h': the row's name as one phrase, as its parts are separate elements. */
function rowName(day: WorkDayDoc, type: WorkDayType, hours: string | null): string {
  return [dayLabel(day.date), TYPE_TEXT[type], hours].filter((part) => part !== null).join(', ');
}

export default function MonthTab() {
  const { uid, settings, settingsLoading, settingsLoaded, clock } = useWork();
  const currentMonth = clock.today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // The month's first day tells which income year it falls in, so stepping between
  // the months of one year keeps the one subscription.
  const { days, loading: daysLoading, error: daysError } = useWorkDays(uid, incomeYearOf(`${month}-01`));
  const loading = daysLoading || settingsLoading;

  // The month's days that have a type (a cleared record has none), newest first.
  const recorded = useMemo(
    () =>
      days
        .filter((day) => day.type !== null && day.date.startsWith(month))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [days, month],
  );

  // A date picked in one month has no place in the next, so moving clears it.
  const showMonth = (key: string) => {
    setMonth(key);
    setSelectedDate(null);
  };

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button type="button" aria-label="Previous month" onClick={() => showMonth(prevMonthKey(month))} className={NAV_BUTTON}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <h2 className="text-sm font-semibold text-ink">{formatMonthLabel(month)}</h2>
          <button
            type="button"
            aria-label="Next month"
            disabled={nextMonthKey(month) > currentMonth}
            onClick={() => showMonth(nextMonthKey(month))}
            className={NAV_BUTTON}
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {loading ? (
          <CalendarSkeleton />
        ) : (
          <MonthCalendar
            month={month}
            days={days}
            settings={settings}
            clock={clock}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
        )}
      </section>

      {/* No editor is mounted while loading: until the days arrive, a missing record means nothing. */}
      {!loading && (
        <>
          <DaySheet date={selectedDate} onClose={() => setSelectedDate(null)}>
            {selectedDate !== null && (
              <DayEditor
                key={selectedDate}
                uid={uid}
                date={selectedDate}
                existing={days.find((day) => day.date === selectedDate) ?? null}
                settings={settings}
                settingsLoaded={settingsLoaded}
                // A failed listener leaves an empty list, not a month with nothing recorded.
                daysLoaded={!daysError}
                clock={clock}
                // A save is acknowledged late when offline, by which time another day may be open.
                onSaved={() => setSelectedDate((current) => (current === selectedDate ? null : current))}
              />
            )}
          </DaySheet>

          {daysError ? (
            <p role="alert" className="px-1 text-sm text-negative">
              Couldn't load your Work days.
            </p>
          ) : recorded.length === 0 ? (
            <p className="px-1 text-sm text-ink-muted">Nothing recorded this month.</p>
          ) : (
            <ul aria-label="Recorded days" className="card divide-y divide-line overflow-hidden">
              {recorded.map((day) => {
                // The filter above kept only days with a type.
                const type = day.type as WorkDayType;
                const hours = type === 'home' && day.minutes !== undefined ? `${formatHours(day.minutes)} h` : null;
                return (
                  <li key={day.date}>
                    <button
                      type="button"
                      aria-label={rowName(day, type, hours)}
                      onClick={() => setSelectedDate(day.date)}
                      // An inset ring, as the list's overflow-hidden would clip an outline.
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left transition hover:bg-recessed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className="flex-1 text-sm font-medium text-ink">{dayLabel(day.date)}</span>
                      <span className="text-sm text-ink-muted">{TYPE_TEXT[type]}</span>
                      {hours !== null && <span className="w-16 text-right text-sm tabular-nums text-ink">{hours}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
