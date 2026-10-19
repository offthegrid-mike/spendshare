import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { planWorkDayWrite, type WorkAction } from '../../lib/work/workDay';
import { formatHours } from '../../lib/work/workTime';
import { writeWorkDay } from '../../lib/work/workWrite';
import { isFinishPassed } from '../../lib/work/workYear';
import SegmentedControl from '../../components/ui/SegmentedControl';
import LoadingButton from '../../components/LoadingButton';
import {
  confirmAction,
  formError,
  formToAction,
  initialForm,
  reduceForm,
  type DayFormState,
  type FormEvent,
} from './dayForm';
import { settleWrite } from './settleWrite';

// One day's form: the type and, for Home, the start, finish and hours (dayForm
// keeps the three in step). Besides saving, it clears the day, confirms a Home
// day's finish and switches a late Home day in or out of the claim. The parent
// remounts it per date with a `key`; within a date the form follows `existing`
// until the user edits it (see the refill below).

interface Props {
  uid: string;
  /** The day, 'YYYY-MM-DD'. */
  date: string;
  /** The day's document, or null if it has none. */
  existing: WorkDayDoc | null;
  settings: WorkSettingsDoc;
  /** The settings come from a real snapshot, not the defaults shown while loading. */
  settingsLoaded: boolean;
  /** The days have loaded, so a null `existing` really means the day has no document. */
  daysLoaded: boolean;
  clock: Clock;
  /** Called once a write has gone through, or straight away offline. */
  onSaved: () => void;
}

const TYPES: { value: WorkDayType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'leave', label: 'Leave' },
];

const FUTURE_DAY = "Future days can't be recorded.";
const LATE_NOTICE =
  "You're filling this in after the day. It will be saved as added later and stays out of the claim until you include it.";
const WRITE_FAILED = "Couldn't save the day. Try again.";

const LABEL = 'mb-1 block text-sm font-medium text-ink';
const ROW = 'flex items-center justify-between gap-3 rounded-[10px] bg-recessed px-3.5 py-2.5';

type Busy = 'save' | 'clear' | 'confirm' | 'claim';

/** Typed hours as whole minutes, or null while the text is not a number of hours. */
function typedMinutes(text: string): number | null {
  if (text.trim() === '') return null;
  const hours = Number(text);
  if (!Number.isFinite(hours) || hours < 0) return null;
  const minutes = Math.round(hours * 60);
  return Number.isFinite(minutes) ? minutes : null;
}

/**
 * The two forms show the same day. Compared by value, as every snapshot brings
 * new objects. Only Home has times: an Office or Leave form keeps the Home times
 * from before a type switch, hidden, and its record has none, so they are ignored.
 */
function sameForm(a: DayFormState, b: DayFormState): boolean {
  if (a.type !== b.type) return false;
  if (a.type !== 'home') return true;
  return a.startTime === b.startTime && a.finishTime === b.finishTime && a.minutes === b.minutes;
}

export default function DayEditor({ uid, date, existing, settings, settingsLoaded, daysLoaded, clock, onSaved }: Props) {
  const id = useId();
  const [form, setForm] = useState(() => initialForm(settings.defaultMinutes, existing));
  // The form the record gave when the form was last filled from it.
  const [seed, setSeed] = useState(form);
  // The Hours text as typed, kept while it is edited so a partial entry such as
  // '7.' survives. Null shows the form's minutes as hours.
  const [hoursText, setHoursText] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failed, setFailed] = useState(false);

  // The record can change under the form: another device edits the day, or this
  // device's own write lands after the form was shown (a sheet's offline save, a
  // Clear day). Writes go against the live record, so a form left showing the old
  // one would write its values back over it. So the form is refilled when the
  // record changes, unless the user has edited it. Adjusting state during render,
  // not in an effect, and never by re-keying, which would lose a pending write's
  // rejection. Nothing moves while a write is pending, nor after a rejected one
  // while the form holds edits: the rejected write's own snapshot, then its
  // rollback, would otherwise replace what was typed.
  const filled = initialForm(settings.defaultMinutes, existing);
  const edited = !sameForm(form, seed);
  if (busy === null && !(failed && edited) && !sameForm(filled, seed)) {
    setSeed(filled);
    if (!edited || sameForm(form, filled)) {
      setForm(filled);
      setHoursText(null);
    }
  }

  if (date > clock.today) return <p className="text-sm text-ink-muted">{FUTURE_DAY}</p>;

  function edit(event: FormEvent) {
    setForm((current) => reduceForm(current, event));
    setFailed(false);
    // Any other field can move the hours, so show the form's hours again.
    setHoursText(null);
  }

  function editHours(text: string) {
    setHoursText(text);
    setFailed(false);
    const minutes = typedMinutes(text);
    if (minutes !== null) setForm((current) => reduceForm(current, { kind: 'minutes', value: minutes }));
  }

  async function run(kind: Busy, action: WorkAction) {
    setBusy(kind);
    setFailed(false);
    try {
      // Awaited only online (settleWrite): Firestore's write promise resolves only
      // when the server acknowledges the write, never offline, and spec 8.2a says
      // the UI must not wait on it. The local cache has the write either way.
      await settleWrite(writeWorkDay(uid, date, action, existing, settingsLoaded ? settings : null));
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const error = formError(form);
  // Only a valid form is turned into a save: planWorkDayWrite throws on times that disagree.
  const save = error === null ? formToAction(form) : null;
  const changes = save !== null && planWorkDayWrite(date, save, existing, clock.today) !== null;
  const showLateNotice = date < clock.today && (error !== null || changes);
  const canWrite = daysLoaded && busy === null;

  const recorded = existing !== null && existing.type !== null;
  const home = existing?.type === 'home' ? existing : null;
  const offerConfirm = home !== null && !home.finishConfirmed && isFinishPassed(home, clock);
  // A confirm keeps the saved start (the writer checks the finish and hours
  // against it), so a changed start is saved with Update day instead.
  const canConfirm = form.type === 'home' && error === null && form.startTime === home?.startTime;
  // A cleared document has no type, so it reads as a day with no record.
  const saveLabel = recorded ? 'Update day' : date === clock.today ? 'Save today' : 'Save day';

  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Day type"
        options={TYPES}
        value={form.type}
        onChange={(type) => edit({ kind: 'type', type })}
      />

      {form.type === 'home' && (
        // Three columns clip a 12-hour time on a phone, so Hours wraps below until sm.
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="min-w-0">
            <label htmlFor={`${id}-start`} className={LABEL}>
              Start
            </label>
            <input
              id={`${id}-start`}
              type="time"
              value={form.startTime}
              onChange={(e) => edit({ kind: 'start', value: e.target.value })}
              className="field money"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-finish`} className={LABEL}>
              Finish
            </label>
            <input
              id={`${id}-finish`}
              type="time"
              value={form.finishTime}
              onChange={(e) => edit({ kind: 'finish', value: e.target.value })}
              className="field money"
            />
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label htmlFor={`${id}-hours`} className={LABEL}>
              Hours
            </label>
            <input
              id={`${id}-hours`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={hoursText ?? formatHours(form.minutes)}
              onChange={(e) => editHours(e.target.value)}
              onBlur={() => setHoursText(null)}
              className="field money"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-negative">{error}</p>}

      {offerConfirm && (
        <div className={ROW}>
          <p className="text-sm text-ink-muted">Finish not confirmed</p>
          <LoadingButton
            loading={busy === 'confirm'}
            disabled={!canWrite || !canConfirm}
            onClick={() => void run('confirm', confirmAction(form))}
            className="btn-outline shrink-0"
          >
            Confirm finish
          </LoadingButton>
        </div>
      )}
      {home?.finishConfirmed && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check size={15} strokeWidth={1.75} className="text-accent-ink" aria-hidden="true" />
          Finish confirmed
        </p>
      )}

      {showLateNotice && (
        <p className="rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{LATE_NOTICE}</p>
      )}

      {failed && (
        <p role="alert" className="text-sm text-negative">
          {WRITE_FAILED}
        </p>
      )}

      <div className="flex gap-2">
        <LoadingButton
          loading={busy === 'save'}
          disabled={!canWrite || !changes}
          onClick={() => {
            if (save) void run('save', save);
          }}
          className="btn-primary h-11 flex-1"
        >
          {saveLabel}
        </LoadingButton>
        {recorded && (
          <LoadingButton
            loading={busy === 'clear'}
            disabled={!canWrite}
            onClick={() => void run('clear', { kind: 'save', type: null })}
            className="btn-ghost h-11 shrink-0"
          >
            Clear day
          </LoadingButton>
        )}
      </div>

      {home?.addedLater && (
        <div className={ROW}>
          <p className="text-sm text-ink-muted">{home.countedInClaim ? 'Included in the claim' : 'Not in the claim'}</p>
          <LoadingButton
            loading={busy === 'claim'}
            disabled={!canWrite}
            onClick={() => void run('claim', { kind: home.countedInClaim ? 'exclude' : 'include' })}
            className="btn-outline shrink-0"
          >
            {home.countedInClaim ? 'Exclude' : 'Include in claim'}
          </LoadingButton>
        </div>
      )}
    </div>
  );
}
