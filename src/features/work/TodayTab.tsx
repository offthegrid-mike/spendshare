import { useMemo, useState } from 'react';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useWorkDays } from '../../hooks/useWorkDays';
import { formatMonthLabel } from '../../lib/month';
import { addDays, incomeYearOf, incomeYearRange, shiftIncomeYear } from '../../lib/work/workDates';
import { missingDates, toConfirmDates } from '../../lib/work/workLists';
import { resolveRate } from '../../lib/work/workRates';
import { summariseYear } from '../../lib/work/workYear';
import DayEditor from './DayEditor';
import DaySheet from './DaySheet';
import MissingBanner from './MissingBanner';
import MonthCalendar from './MonthCalendar';
import TodayCard from './TodayCard';
import { useWork } from './WorkContext';
import YearToDateCard from './YearToDateCard';

// The Today tab: the gaps to fill, today's day, this month at a glance and the
// income year so far. A day picked from the banner or the calendar opens in a
// DaySheet; the editor in it is keyed by the date so each pick starts afresh.
// While a day is open the Today card's editor is hidden, so there is only ever one editor.

// Days at the start of an income year (1 to 14 July) in which the banner also
// looks back at the year that has just ended.
const EARLY_DAYS = 14;

const NOOP = () => {};

const LOAD_FAILED = "Couldn't load your Work days.";

export default function TodayTab() {
  const { uid, settings, settingsLoading, settingsLoaded, clock } = useWork();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const incomeYear = incomeYearOf(clock.today);
  const yearStart = incomeYearRange(incomeYear).start;
  // A day left unconfirmed in June is still worth a nudge in the first days of July.
  const early = clock.today < addDays(yearStart, EARLY_DAYS);
  // A previous-year day opened from the banner stays open past the window, and
  // its editor needs the record to write against until it closes.
  const watchPrevious = early || (selectedDate !== null && selectedDate < yearStart);
  const { days, loading: daysLoading, error: daysError } = useWorkDays(uid, incomeYear);
  // Always called (hooks cannot be conditional); no uid means no subscription.
  const { days: previousDays, loading: previousLoading, error: previousError } = useWorkDays(
    watchPrevious ? uid : undefined,
    shiftIncomeYear(incomeYear, -1),
  );

  const rate = useMemo(() => resolveRate(incomeYear, settings.ratesCentsPerHour), [incomeYear, settings.ratesCentsPerHour]);
  const summary = useMemo(() => summariseYear(days, rate.cents, clock), [days, rate.cents, clock]);
  const missing = useMemo(() => missingDates(days, settings, clock), [days, settings, clock]);
  // The previous year's dates all precede this year's, so joining them keeps the list ascending.
  const toConfirm = useMemo(
    () => [...(early ? toConfirmDates(previousDays, clock) : []), ...toConfirmDates(days, clock)],
    [early, previousDays, days, clock],
  );

  if (daysLoading || previousLoading || settingsLoading) return <RouteSkeleton />;

  // Past the skeleton the days and the settings have loaded, unless a listener
  // failed. A failed days listener leaves an empty list that reads as a year with
  // nothing recorded, so then the editors write nothing and the banner nudges nothing.
  const daysLoaded = !daysError && !previousError;
  const existingOn = (date: string) => [...previousDays, ...days].find((day) => day.date === date) ?? null;
  const month = clock.today.slice(0, 7);

  return (
    <div className="space-y-4">
      {daysLoaded ? (
        <MissingBanner missing={missing} toConfirm={toConfirm} onPick={setSelectedDate} />
      ) : (
        <p role="alert" className="px-1 text-sm text-negative">
          {LOAD_FAILED}
        </p>
      )}

      <TodayCard
        uid={uid}
        existing={existingOn(clock.today)}
        settings={settings}
        settingsLoaded={settingsLoaded}
        daysLoaded={daysLoaded}
        clock={clock}
        onSaved={NOOP}
        editorHidden={selectedDate !== null}
      />

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{formatMonthLabel(month)}</h2>
          <span className="text-xs text-ink-muted">tap a day to edit</span>
        </div>
        <MonthCalendar
          month={month}
          days={days}
          settings={settings}
          clock={clock}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      </section>

      <DaySheet date={selectedDate} onClose={() => setSelectedDate(null)}>
        {selectedDate !== null && (
          <DayEditor
            key={selectedDate}
            uid={uid}
            date={selectedDate}
            existing={existingOn(selectedDate)}
            settings={settings}
            settingsLoaded={settingsLoaded}
            daysLoaded={daysLoaded}
            clock={clock}
            // A save is acknowledged late when offline, by which time another day may be open.
            onSaved={() => setSelectedDate((current) => (current === selectedDate ? null : current))}
          />
        )}
      </DaySheet>

      <YearToDateCard summary={summary} rate={rate} incomeYear={incomeYear} />
    </div>
  );
}
