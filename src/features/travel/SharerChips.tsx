import { memberName } from '../../lib/balance';
import type { GroupDoc } from '../../types/models';

interface Props {
  trip: GroupDoc;
  viewerUid: string;
  /** Accessible name of the group, e.g. "Item 1 shared with". */
  label: string;
  value: string[];
  onChange: (uids: string[]) => void;
}

/** Toggle chips for who shares an item: one per member, pressed when they share it. */
export default function SharerChips({ trip, viewerUid, label, value, onChange }: Props) {
  // Keep anyone already chosen who has since left the trip, so editing never drops their share.
  const uids = [...trip.memberUids, ...value.filter((uid) => !trip.memberUids.includes(uid))];

  function toggle(uid: string) {
    onChange(value.includes(uid) ? value.filter((u) => u !== uid) : uids.filter((u) => u === uid || value.includes(u)));
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {uids.map((uid) => {
        const on = value.includes(uid);
        return (
          <button
            key={uid}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(uid)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              on ? 'border-transparent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            {uid === viewerUid ? 'You' : memberName(trip, uid)}
          </button>
        );
      })}
    </div>
  );
}
