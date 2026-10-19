import { useId } from 'react';
import LoadingButton from '../../components/LoadingButton';
import { byDate, dayLabel } from '../../lib/work/workFormat';
import { formatHours } from '../../lib/work/workTime';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { REVIEW_WRITE_FAILED, useReviewWrite } from './useReviewWrite';

// The Home days saved after the day (spec 7.3), each with a switch in or out of
// the claim. A day stays listed after it is included, so it can be excluded again.

interface Props {
  uid: string;
  /** The income year's days, in any order. */
  days: WorkDayDoc[];
  /** The loaded settings, or null while they are not loaded (see writeWorkDay). */
  settings: WorkSettingsDoc | null;
}

export default function LateDaysReview({ uid, days, settings }: Props) {
  const headingId = useId();
  const { busyDate, failed, run } = useReviewWrite(uid, settings);

  const late = days
    .filter((day) => day.type === 'home' && day.addedLater)
    .sort(byDate);
  if (late.length === 0) return null;

  return (
    <section id="late" aria-labelledby={headingId} className="card scroll-mt-20 p-4">
      <h2 id={headingId} className="text-sm font-semibold text-ink">
        Added later
      </h2>
      <p className="mb-2 text-[13px] text-ink-muted">Saved after the day, so they count only once you include them.</p>
      {failed && (
        <p role="alert" className="mb-2 text-sm text-negative">
          {REVIEW_WRITE_FAILED}
        </p>
      )}
      <ul className="divide-y divide-line">
        {late.map((day) => (
          <li key={day.date} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{dayLabel(day.date)}</p>
              <p className="text-[13px] text-ink-muted">
                <span className="tabular-nums">{`${formatHours(day.minutes ?? 0)} h`}</span>
                {' · '}
                {day.countedInClaim ? 'Included' : 'Not in the claim'}
              </p>
            </div>
            <LoadingButton
              loading={busyDate === day.date}
              disabled={busyDate !== null}
              onClick={() => void run(day, { kind: day.countedInClaim ? 'exclude' : 'include' })}
              className="btn-outline h-9 shrink-0"
            >
              {day.countedInClaim ? 'Exclude' : 'Include'}
            </LoadingButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
