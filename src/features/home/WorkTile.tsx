import { useMemo } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import Skeleton from '../../components/ui/Skeleton';
import { useWorkClock } from '../../hooks/useWorkClock';
import { useWorkDays } from '../../hooks/useWorkDays';
import { useWorkSettings } from '../../hooks/useWorkSettings';
import { paths } from '../../lib/paths';
import { incomeYearLabel, incomeYearOf } from '../../lib/work/workDates';
import { shortDayLabel } from '../../lib/work/workFormat';
import type { WorkAction } from '../../lib/work/workDay';
import { missingDates, toConfirmDates } from '../../lib/work/workLists';
import { resolveRate } from '../../lib/work/workRates';
import { recentWorkingDays, todayStatus, type RecentStatus, type TodayStatus } from '../../lib/work/workRecent';
import { formatHours } from '../../lib/work/workTime';
import { writeWorkDay } from '../../lib/work/workWrite';
import { summariseYear } from '../../lib/work/workYear';
import { settleWrite } from '../work/settleWrite';

// Home's Work tile (spec 6.4): today's status, the gaps to fill, the Home hours so
// far this income year and a strip of the last five working days, with a way into
// Work. It loads only the income year containing today, like the Today tab. While
// today is unrecorded it also offers two shortcuts, Home at the default hours or
// Office, so a normal day is one tap. Start and finish are left for Work.

const LINE = 'flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px] text-ink-muted';

const TYPE_TEXT = { home: 'Home', office: 'Office', leave: 'Leave' } as const;

const CHIP_TEXT: Record<RecentStatus, string> = {
  home: 'Home',
  office: 'Office',
  leave: 'Leave',
  missing: 'Missing',
  unrecorded: 'Not yet',
  none: '—',
};

// The calendar's colours for each kind of day, so the strip reads the same way.
const CHIP_CLASS: Record<RecentStatus, string> = {
  home: 'border-transparent bg-accent-soft text-accent-ink',
  office: 'border-transparent bg-recessed text-ink',
  leave: 'border-dashed border-ink-faint text-ink-muted',
  missing: 'border-dotted border-warning bg-warning-soft text-warning',
  unrecorded: 'border-line text-ink-muted',
  none: 'border-transparent text-ink-faint',
};

function todayText(status: TodayStatus): string {
  if (status.kind === 'offday') return 'Not a work day';
  if (status.kind === 'unrecorded') return 'Not recorded';
  const type = TYPE_TEXT[status.type];
  return status.minutes !== undefined ? `${type} · ${formatHours(status.minutes)} h` : type;
}

export default function WorkTile({ uid }: { uid: string }) {
  const clock = useWorkClock();
  const incomeYear = incomeYearOf(clock.today);
  const { settings, loading: settingsLoading, loaded } = useWorkSettings(uid);
  const { days, loading: daysLoading, error } = useWorkDays(uid, incomeYear);
  const loading = settingsLoading || daysLoading;
  const [saving, setSaving] = useState<'home' | 'office' | null>(null);
  const [failed, setFailed] = useState(false);

  // Records today from the tile. Like DayEditor, the write is awaited only online
  // (settleWrite), and the live day snapshot brings the new status back to the tile.
  async function recordToday(type: 'home' | 'office') {
    setSaving(type);
    setFailed(false);
    const action: WorkAction = type === 'home' ? { kind: 'save', type, minutes: settings.defaultMinutes } : { kind: 'save', type };
    try {
      const existing = days.find((day) => day.date === clock.today) ?? null;
      await settleWrite(writeWorkDay(uid, clock.today, action, existing, loaded ? settings : null));
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  }

  const figures = useMemo(() => {
    const rate = resolveRate(incomeYear, settings.ratesCentsPerHour);
    return {
      today: todayStatus(days, settings, clock),
      missing: missingDates(days, settings, clock).length,
      toConfirm: toConfirmDates(days, clock).length,
      countedMinutes: summariseYear(days, rate.cents, clock).counted.minutes,
      recent: recentWorkingDays(days, settings, clock),
    };
  }, [days, settings, clock, incomeYear]);

  let body;
  if (loading) {
    body = (
      <div role="status" aria-label="Loading figures">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
        <Skeleton className="mt-2 h-12 w-full rounded-[10px]" />
      </div>
    );
  } else if (error) {
    body = <p className="border-t border-line py-2 text-[13px] text-negative">Couldn't load your Work days.</p>;
  } else {
    const { today, missing, toConfirm, countedMinutes, recent } = figures;
    body = (
      <div>
        {today.kind === 'unrecorded' && (
          <div className="pb-2.5">
            <div className="flex gap-2">
              <LoadingButton
                loading={saving === 'home'}
                disabled={saving !== null}
                onClick={() => void recordToday('home')}
                className="btn-primary h-10 flex-1"
              >
                {`Home · ${formatHours(settings.defaultMinutes)} h`}
              </LoadingButton>
              <LoadingButton
                loading={saving === 'office'}
                disabled={saving !== null}
                onClick={() => void recordToday('office')}
                className="btn-outline h-10 flex-1"
              >
                Office
              </LoadingButton>
            </div>
            {failed && (
              <p role="alert" className="mt-2 text-[13px] text-negative">
                Couldn't save today. Try again.
              </p>
            )}
          </div>
        )}
        <p className={LINE}>
          <span>Today</span>
          <span className={today.kind === 'unrecorded' ? 'font-semibold text-warning' : 'text-ink'}>{todayText(today)}</span>
        </p>
        <p className={LINE}>
          <span>Weekdays missing</span>
          <span className={`tabular-nums ${missing > 0 ? 'font-semibold text-warning' : 'text-ink'}`}>{missing}</span>
        </p>
        {toConfirm > 0 && (
          <p className={LINE}>
            <span>To confirm</span>
            <span className="font-semibold tabular-nums text-warning">{toConfirm}</span>
          </p>
        )}
        <p className={LINE}>
          <span>From home</span>
          <span className="money text-ink">{`${formatHours(countedMinutes)} h`}</span>
        </p>
        <div className="border-t border-line pt-2.5">
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Recent working days</h3>
          <ol aria-label="Recent working days" className="grid grid-cols-5 gap-1.5">
            {recent.map((day) => (
              <li
                key={day.date}
                aria-current={day.isToday ? 'date' : undefined}
                className={`flex min-w-0 flex-col items-center rounded-[9px] border px-0.5 py-1.5 text-center ${CHIP_CLASS[day.status]} ${
                  day.isToday ? 'ring-2 ring-accent/40' : ''
                }`}
              >
                <span className="text-[11px] font-semibold">{shortDayLabel(day.date)}</span>
                <span className="truncate text-[11px]">{CHIP_TEXT[day.status]}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Work" className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={paths.work}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
            <Briefcase size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Work</h2>
            <span className="block text-xs text-ink-muted">{`Income year ${incomeYearLabel(incomeYear)}`}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="ml-auto text-ink-faint" aria-hidden="true" />
        </Link>
        <Link to={paths.work} className="btn-outline hidden lg:inline-flex">
          Record today
        </Link>
      </div>
      {body}
    </section>
  );
}
