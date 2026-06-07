import { useUIStore } from '../stores/uiStore';
import type { GroupDoc } from '../types/models';

interface Props { groups: GroupDoc[]; }

export default function GroupSwitcher({ groups }: Props) {
  const { selectedGroupId, setGroup } = useUIStore();

  return (
    <select
      value={selectedGroupId ?? ''}
      onChange={(e) => setGroup(e.target.value)}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}
