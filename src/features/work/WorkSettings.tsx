import { useId, useRef, useState, type ReactNode } from 'react';
import { RouteSkeleton } from '../../components/AppSkeletons';
import AccountSection from '../../components/AccountSection';
import LoadingButton from '../../components/LoadingButton';
import { incomeYearLabel, incomeYearOf, shiftIncomeYear } from '../../lib/work/workDates';
import { resolveRate } from '../../lib/work/workRates';
import { formatHours } from '../../lib/work/workTime';
import { saveWorkSettings } from '../../lib/work/workWrite';
import type { WorkSettingsDoc } from '../../types/models';
import { settleWrite } from './settleWrite';
import { useWork } from './WorkContext';

// The Settings tab: the usual work days, the default hours of a day and the rate
// per hour for the current income year and the two before it. Each section keeps
// its own text and has its own Save button, and a save writes just the fields
// that section changes (a merge patch), so a section never overwrites another.
// The sections start from the settings once, when they mount, so the tab shows
// them only after the settings have loaded.

const WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

/** The most hours a day can have. */
const MAX_HOURS = 24;
/** How many income years the rate section lists, the current one first. */
const RATE_YEARS = 3;

const LOAD_FAILED = "Couldn't load your Work settings.";
const WRITE_FAILED = "Couldn't save. Try again.";

const HEADING = 'mb-2 px-1 text-sm font-medium text-ink-muted';
const HINT = 'text-sm text-ink-muted';

/** Typed hours as whole minutes, or null unless they are a number of hours above 0 and up to 24. */
function typedMinutes(text: string): number | null {
  const trimmed = text.trim();
  // Only a plain decimal: Number() alone would also take '1e1', '0x10' and 'Infinity'.
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  if (!(hours > 0 && hours <= MAX_HOURS)) return null;
  const minutes = Math.round(hours * 60);
  // A sliver of an hour rounds to no time at all.
  return minutes >= 1 ? minutes : null;
}

/** Typed cents per hour, or null unless they are a whole number of cents above 0. */
function typedCents(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const cents = Number(trimmed);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents : null;
}

/** One section's save: whether a write is under way and how the last one ended. */
function useSettingsSave(uid: string) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | null>(null);
  // Counts the edits made so far. Online, a write is acknowledged only when the
  // server answers, so the field can be edited while it is pending.
  const edits = useRef(0);

  async function save(patch: Partial<WorkSettingsDoc>) {
    const editsBefore = edits.current;
    setBusy(true);
    setOutcome(null);
    try {
      // Awaited only online (settleWrite): Firestore's write promise resolves only
      // when the server acknowledges the write, never offline, and spec 8.2a says
      // the UI must not wait on it. The local cache has the write either way.
      await settleWrite(saveWorkSettings(uid, patch));
      // Saved speaks for what was written: after an edit it would not be true of
      // what is typed now. A failure stays true of the attempt, so it is shown.
      if (edits.current === editsBefore) setOutcome('saved');
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(false);
    }
  }

  /** Called on every edit: the last outcome says nothing about what is typed now. */
  const clearOutcome = () => {
    edits.current += 1;
    setOutcome(null);
  };

  return { busy, outcome, save, clearOutcome };
}

/** The Save button of a section, with how its last save went beside and below it. */
function SaveRow({
  label,
  className,
  busy,
  disabled,
  outcome,
  onSave,
}: {
  label: string;
  className: string;
  busy: boolean;
  disabled: boolean;
  outcome: 'saved' | 'failed' | null;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <LoadingButton loading={busy} disabled={disabled} onClick={onSave} className={className}>
          {label}
        </LoadingButton>
        {outcome === 'saved' && (
          <p role="status" className={HINT}>
            Saved
          </p>
        )}
      </div>
      {outcome === 'failed' && (
        <p role="alert" className="text-sm text-negative">
          {WRITE_FAILED}
        </p>
      )}
    </>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function WorkDaysSection({ uid, settings }: { uid: string; settings: WorkSettingsDoc }) {
  const headingId = useId();
  // Only 1 to 7 can be ticked, so any other stored value is dropped here.
  const [ticked, setTicked] = useState(
    () => new Set(WEEKDAYS.filter((day) => settings.workWeekdays.includes(day.iso)).map((day) => day.iso)),
  );
  const { busy, outcome, save, clearOutcome } = useSettingsSave(uid);

  function toggle(iso: number) {
    const next = new Set(ticked);
    if (!next.delete(iso)) next.add(iso);
    setTicked(next);
    clearOutcome();
  }

  return (
    <Section id={headingId} title="Usual work days">
      <div className="card space-y-3 p-4">
        <p className={HINT}>The days you normally work. Only these days are flagged when they are not filled in.</p>
        <div role="group" aria-labelledby={headingId} className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map(({ iso, label }) => (
            <label key={iso} className="block">
              <input
                type="checkbox"
                checked={ticked.has(iso)}
                onChange={() => toggle(iso)}
                className="peer sr-only"
              />
              <span className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface text-sm font-medium text-ink-muted transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                {label}
              </span>
            </label>
          ))}
        </div>
        <SaveRow
          label="Save work days"
          className="btn-primary h-11"
          busy={busy}
          disabled={ticked.size === 0}
          outcome={outcome}
          onSave={() => void save({ workWeekdays: [...ticked].sort((a, b) => a - b) })}
        />
      </div>
    </Section>
  );
}

function DefaultHoursSection({ uid, settings }: { uid: string; settings: WorkSettingsDoc }) {
  const headingId = useId();
  // The text as typed, so a partial entry such as '7.' survives while it is edited.
  const [text, setText] = useState(() => formatHours(settings.defaultMinutes));
  const { busy, outcome, save, clearOutcome } = useSettingsSave(uid);
  const minutes = typedMinutes(text);

  return (
    <Section id={headingId} title="Default hours">
      <div className="card space-y-3 p-4">
        <p className={HINT}>The hours a new Home day starts with.</p>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-labelledby={headingId}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            clearOutcome();
          }}
          className="field money h-11 w-28"
        />
        <SaveRow
          label="Save default hours"
          className="btn-primary h-11"
          busy={busy}
          disabled={minutes === null}
          outcome={outcome}
          onSave={() => {
            if (minutes !== null) void save({ defaultMinutes: minutes });
          }}
        />
      </div>
    </Section>
  );
}

function RateRow({ uid, year, settings }: { uid: string; year: string; settings: WorkSettingsDoc }) {
  const labelId = useId();
  const rate = resolveRate(year, settings.ratesCentsPerHour);
  const [text, setText] = useState(() => String(rate.cents));
  const { busy, outcome, save, clearOutcome } = useSettingsSave(uid);
  const cents = typedCents(text);

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-2 p-4">
      <p id={labelId} className="text-sm font-medium text-ink">
        {incomeYearLabel(year)}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Rate in cents per hour"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            clearOutcome();
          }}
          className="field money h-11 w-24"
        />
        <span aria-hidden="true" className={HINT}>
          c/h
        </span>
      </div>
      {rate.source === 'carried' && rate.carriedFrom !== undefined && (
        <p className={HINT}>
          {`${rate.cents}c is the ${incomeYearLabel(rate.carriedFrom)} rate until you set one`}
        </p>
      )}
      <SaveRow
        label="Save rate"
        className="btn-outline h-11"
        busy={busy}
        disabled={cents === null}
        outcome={outcome}
        onSave={() => {
          if (cents !== null) void save({ ratesCentsPerHour: { [year]: cents } });
        }}
      />
    </div>
  );
}

function RatesSection({ uid, settings, today }: { uid: string; settings: WorkSettingsDoc; today: string }) {
  const current = incomeYearOf(today);
  // Newest first: the current income year, then the ones before it.
  const years = Array.from({ length: RATE_YEARS }, (_, back) => shiftIncomeYear(current, -back));

  return (
    <Section title="Rate per hour">
      <div className="card divide-y divide-line overflow-hidden">
        {years.map((year) => (
          <RateRow key={year} uid={uid} year={year} settings={settings} />
        ))}
      </div>
    </Section>
  );
}

export default function WorkSettings() {
  const { uid, settings, settingsLoading, settingsLoaded, clock } = useWork();

  if (settingsLoading) return <RouteSkeleton />;

  // After a listener error `settings` holds the defaults. The work days and the
  // default hours are saved as whole values, so editing from the defaults could
  // replace the user's real ones: nothing is shown to edit until a real snapshot
  // has arrived. Appearance and Sign out do not depend on the settings.
  if (!settingsLoaded) {
    return (
      <div className="space-y-6">
        <p role="alert" className="px-1 text-sm text-negative">
          {LOAD_FAILED}
        </p>
        <AccountSection />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkDaysSection uid={uid} settings={settings} />
      <DefaultHoursSection uid={uid} settings={settings} />
      <RatesSection uid={uid} settings={settings} today={clock.today} />
      <AccountSection />
    </div>
  );
}
