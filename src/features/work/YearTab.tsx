import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useWorkDays } from '../../hooks/useWorkDays';
import { downloadCsv } from '../../lib/work/downloadCsv';
import { incomeYearLabel, incomeYearOf, shiftIncomeYear } from '../../lib/work/workDates';
import { daysCsv, exportFileName, revisionsCsv } from '../../lib/work/workExport';
import { KNOWN_RATES, resolveRate } from '../../lib/work/workRates';
import { monthlyTotals, summariseYear } from '../../lib/work/workYear';
import DayEditor from './DayEditor';
import DaySheet from './DaySheet';
import LateDaysReview from './LateDaysReview';
import MonthlyTotals from './MonthlyTotals';
import NotConfirmedReview from './NotConfirmedReview';
import { useWork } from './WorkContext';
import YearToDateCard from './YearToDateCard';

// The Year tab (spec 7.1): one income year at a time, from the first year with a
// fixed rate up to the current one, with its totals, the reviews of late and
// unconfirmed days, and the CSV export. A link such as /work/year#late (from the
// year card on Today) scrolls to that review once the days have loaded.

// The fixed rate method starts in the first year with a known rate.
const FIRST_YEAR = Object.keys(KNOWN_RATES).sort()[0];

const NAV_BUTTON = 'btn-ghost h-9 w-9 shrink-0 px-0';

export default function YearTab() {
  const { uid, settings, settingsLoading, settingsLoaded, clock } = useWork();
  const { hash } = useLocation();
  const exportHeadingId = useId();
  const currentYear = incomeYearOf(clock.today);
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { days, loading: daysLoading, error } = useWorkDays(uid, year);
  const loading = daysLoading || settingsLoading;

  const rate = useMemo(() => resolveRate(year, settings.ratesCentsPerHour), [year, settings.ratesCentsPerHour]);
  const summary = useMemo(() => summariseYear(days, rate.cents, clock), [days, rate.cents, clock]);
  const totals = useMemo(() => monthlyTotals(days), [days]);

  // Scroll to the review named in the address once, when it can first be there.
  const scrolled = useRef(false);
  const ready = !loading && !error;
  useEffect(() => {
    if (!ready || scrolled.current || hash.length < 2) return;
    scrolled.current = true;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);

  // A day picked in one year has no place in another, so moving clears it.
  const showYear = (key: string) => {
    setYear(key);
    setSelectedDate(null);
  };

  const label = incomeYearLabel(year);
  const writeSettings = settingsLoaded ? settings : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Previous income year"
          disabled={year <= FIRST_YEAR}
          onClick={() => showYear(shiftIncomeYear(year, -1))}
          className={NAV_BUTTON}
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h2 className="text-base font-semibold text-ink">{label}</h2>
        <button
          type="button"
          aria-label="Next income year"
          disabled={year >= currentYear}
          onClick={() => showYear(shiftIncomeYear(year, 1))}
          className={NAV_BUTTON}
        >
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <RouteSkeleton />
      ) : error ? (
        <p role="alert" className="px-1 text-sm text-negative">
          Couldn't load your Work days.
        </p>
      ) : (
        <>
          <YearToDateCard
            summary={summary}
            rate={rate}
            incomeYear={year}
            linkToYear={false}
            finished={year < currentYear}
          />

          {totals.length === 0 ? (
            <p className="px-1 text-sm text-ink-muted">{`No days recorded in ${label}.`}</p>
          ) : (
            <MonthlyTotals totals={totals} />
          )}

          <LateDaysReview uid={uid} days={days} settings={writeSettings} />
          <NotConfirmedReview uid={uid} days={days} settings={writeSettings} clock={clock} onEdit={setSelectedDate} />

          <DaySheet date={selectedDate} onClose={() => setSelectedDate(null)}>
            {selectedDate !== null && (
              <DayEditor
                key={selectedDate}
                uid={uid}
                date={selectedDate}
                existing={days.find((day) => day.date === selectedDate) ?? null}
                settings={settings}
                settingsLoaded={settingsLoaded}
                daysLoaded
                clock={clock}
                // A save is acknowledged late when offline, by which time another day may be open.
                onSaved={() => setSelectedDate((current) => (current === selectedDate ? null : current))}
              />
            )}
          </DaySheet>

          <section aria-labelledby={exportHeadingId} className="card p-4">
            <h2 id={exportHeadingId} className="text-sm font-semibold text-ink">
              Export
            </h2>
            <p className="mb-3 text-[13px] text-ink-muted">
              {`Two spreadsheet files for ${label}: each day with the year's totals, and every change made to a day.`}
            </p>
            {/* flex-1 only in a row: in the phone's column it would collapse the buttons' height. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => downloadCsv(exportFileName('days', year), daysCsv(days, year, rate, clock))}
                className="btn-outline h-11 sm:flex-1"
              >
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                Download days (CSV)
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(exportFileName('revisions', year), revisionsCsv(days))}
                className="btn-outline h-11 sm:flex-1"
              >
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                Download changes (CSV)
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
