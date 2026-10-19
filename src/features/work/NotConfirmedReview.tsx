import { useId } from 'react';
import LoadingButton from '../../components/LoadingButton';
import type { Clock } from '../../lib/work/workDates';
import { byDate, dayLabel } from '../../lib/work/workFormat';
import { isUnconfirmed } from '../../lib/work/workYear';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { REVIEW_WRITE_FAILED, useReviewWrite } from './useReviewWrite';

// The Home days whose finish has passed without being confirmed (spec 7.2a),
// including late days left out of the claim, which are marked so the list
// agrees with the year card's count of days that still count. Each is confirmed
// on its own, as saved, or opened to change the finish first. There is
// deliberately no confirm-all: a batch of old days is not approved with one tap.

interface Props {
  uid: string;
  /** The income year's days, in any order. */
  days: WorkDayDoc[];
  /** The loaded settings, or null while they are not loaded (see writeWorkDay). */
  settings: WorkSettingsDoc | null;
  clock: Clock;
  onEdit: (date: string) => void;
}

export default function NotConfirmedReview({ uid, days, settings, clock, onEdit }: Props) {
  const headingId = useId();
  const { busyDate, failed, run } = useReviewWrite(uid, settings);

  const waiting = days
    .filter((day) => isUnconfirmed(day, clock))
    .sort(byDate);
  if (waiting.length === 0) return null;

  return (
    <section id="confirm" aria-labelledby={headingId} className="card scroll-mt-20 p-4">
      <h2 id={headingId} className="text-sm font-semibold text-ink">
        Not confirmed
      </h2>
      <p className="mb-2 text-[13px] text-ink-muted">Finish times that have passed. Confirm each one as it is, or edit it first.</p>
      {failed && (
        <p role="alert" className="mb-2 text-sm text-negative">
          {REVIEW_WRITE_FAILED}
        </p>
      )}
      <ul className="divide-y divide-line">
        {waiting.map((day) => (
          <li key={day.date} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{dayLabel(day.date)}</p>
              <p className="text-[13px] tabular-nums text-ink-muted">{`Finish ${day.finishTime ?? ''}${day.countedInClaim ? '' : ' · not in the claim'}`}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyDate !== null}
                onClick={() => onEdit(day.date)}
                className="btn-ghost h-9"
              >
                Edit
              </button>
              <LoadingButton
                loading={busyDate === day.date}
                disabled={busyDate !== null}
                onClick={() =>
                  void run(day, { kind: 'confirm', finishTime: day.finishTime, minutes: day.minutes })
                }
                className="btn-outline h-9"
              >
                Confirm finish
              </LoadingButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
