import { ChevronsUpDown } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { AvatarStack } from './ui/Avatar';
import type { GroupDoc } from '../types/models';

interface Props {
  groups: GroupDoc[];
  currentUid: string;
}

function membersOf(group: GroupDoc, currentUid: string) {
  return Object.entries(group.members)
    .map(([uid, m]) => ({ name: m.displayName || m.email || '?', isMe: uid === currentUid }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe));
}

/** Member initials + group name; a transparent native select switches group when there are several. */
export default function GroupSwitcher({ groups, currentUid }: Props) {
  const { selectedGroupId, setGroup } = useUIStore();
  const group = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  if (!group) return null;
  const switchable = groups.length > 1;

  return (
    <span
      className={`relative flex min-w-0 items-center gap-2 rounded-[10px] px-1.5 py-1 font-semibold text-ink ${
        switchable ? 'hover:bg-recessed focus-within:ring-2 focus-within:ring-accent/40' : ''
      }`}
    >
      <AvatarStack people={membersOf(group, currentUid)} />
      <span className="truncate">{group.name}</span>
      {switchable && (
        <>
          <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <select
            aria-label="Switch group"
            value={group.id}
            onChange={(e) => setGroup(e.target.value)}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </>
      )}
    </span>
  );
}
