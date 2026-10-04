import Avatar from '../../components/ui/Avatar';
import { memberName } from '../../lib/balance';
import type { GroupDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  viewerUid: string;
  value: string;
  onChange: (uid: string) => void;
}

// Above this many people, pills wrap awkwardly; use the native select.
const MAX_PILLS = 4;

/** "Paid by": member pills (a radio group), or a select for big groups. */
export default function PayerPicker({ group, viewerUid, value, onChange }: Props) {
  // Keep a payer who has since left the group, so editing never silently
  // reassigns the expense to someone else.
  const uids = group.memberUids.includes(value) || !value ? group.memberUids : [...group.memberUids, value];
  const label = (uid: string) => (uid === viewerUid ? 'You' : memberName(group, uid));

  if (uids.length > MAX_PILLS) {
    return (
      <div>
        <label htmlFor="payerUid" className="mb-1 block text-sm font-medium text-ink">Paid by</label>
        <select id="payerUid" value={value} onChange={(e) => onChange(e.target.value)} className="field">
          {uids.map((uid) => (
            <option key={uid} value={uid}>{label(uid)}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <p id="payer-label" className="mb-1 text-sm font-medium text-ink">Paid by</p>
      <div role="radiogroup" aria-labelledby="payer-label" className="flex flex-wrap gap-2">
        {uids.map((uid) => {
          const checked = uid === value;
          return (
            <label
              key={uid}
              className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-accent/40 ${
                checked ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink-muted hover:bg-recessed'
              }`}
            >
              <input
                type="radio"
                name="payerUid"
                value={uid}
                checked={checked}
                onChange={() => onChange(uid)}
                className="sr-only"
              />
              <Avatar name={memberName(group, uid)} tone={uid === viewerUid ? 'me' : 'them'} />
              {label(uid)}
            </label>
          );
        })}
      </div>
    </div>
  );
}
