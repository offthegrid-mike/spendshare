import { AvatarStack } from '../../components/ui/Avatar';
import { membersOf } from '../../lib/groupMembers';
import type { GroupDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUid: string;
  /** Omitted when the expense can't move (editing an existing one). */
  onChange?: () => void;
  /** Ref to the Change button, so the editor can return focus to it. */
  changeRef?: React.Ref<HTMLButtonElement>;
}

/** Which group the expense is recorded in. */
export default function GroupChip({ group, currentUid, onChange, changeRef }: Props) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2">
      <AvatarStack people={membersOf(group, currentUid)} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-muted">Recording in</span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{group.name}</span>
          <span className="shrink-0 text-xs text-ink-muted">{group.currency}</span>
        </span>
      </span>
      {onChange && (
        <button
          ref={changeRef}
          type="button"
          onClick={onChange}
          aria-label={`Change group, currently ${group.name}`}
          className="btn-ghost h-8 px-2.5 text-accent-ink hover:text-accent-ink"
        >
          Change
        </button>
      )}
    </div>
  );
}
