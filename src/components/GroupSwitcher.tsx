import { useUIStore } from '../stores/uiStore';
import type { GroupDoc } from '../types/models';

interface Props { groups: GroupDoc[]; }

export default function GroupSwitcher({ groups }: Props) {
  const { selectedGroupId, setGroup } = useUIStore();

  return (
    <select
      value={selectedGroupId ?? ''}
      onChange={(e) => setGroup(e.target.value)}
      className="rounded-lg border border-white/30 bg-white/15 px-2.5 py-1 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 [&>option]:text-slate-900"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}
