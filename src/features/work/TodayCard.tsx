import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { dayLabel } from '../../lib/work/workFormat';
import DayEditor from './DayEditor';

// Today's day editor under a heading that says where it stands. The editor is
// keyed by the date, so it starts afresh when the clock passes midnight. While
// the day sheet is open for today the editor is left out, so one date never has
// two editors: DayEditor keeps a form's edits over a new record, so edits left in
// a second one would be written back over a save made from the first.

interface Props {
  uid: string;
  /** Today's document, or null if it has none. */
  existing: WorkDayDoc | null;
  settings: WorkSettingsDoc;
  /** The settings come from a real snapshot, not the defaults shown while loading. */
  settingsLoaded: boolean;
  /** The days have loaded, so a null `existing` really means today has no document. */
  daysLoaded: boolean;
  clock: Clock;
  onSaved: () => void;
  /** Leaves the editor out, keeping the heading and status. It mounts afresh when shown again. */
  editorHidden?: boolean;
}

/** A cleared day (type null) reads as no record. */
function statusText(existing: WorkDayDoc | null): string {
  if (existing === null || existing.type === null) return 'not saved yet';
  return existing.type === 'home' && existing.finishConfirmed ? 'finish confirmed' : 'saved';
}

export default function TodayCard({
  uid,
  existing,
  settings,
  settingsLoaded,
  daysLoaded,
  clock,
  onSaved,
  editorHidden = false,
}: Props) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{`Today · ${dayLabel(clock.today)}`}</h2>
        <span className="text-xs text-ink-muted">{statusText(existing)}</span>
      </div>
      {!editorHidden && (
        <DayEditor
          key={clock.today}
          uid={uid}
          date={clock.today}
          existing={existing}
          settings={settings}
          settingsLoaded={settingsLoaded}
          daysLoaded={daysLoaded}
          clock={clock}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
