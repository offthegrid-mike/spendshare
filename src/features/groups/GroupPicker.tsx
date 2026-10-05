import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { User } from 'firebase/auth';
import { Check, ChevronLeft, Plus } from 'lucide-react';
import { AvatarStack } from '../../components/ui/Avatar';
import CreateGroupForm from './CreateGroupForm';
import { membersOf } from '../../lib/groupMembers';
import type { GroupDoc } from '../../types/models';

export type GroupPickerView = 'list' | 'create';

export interface PickInfo {
  /** True when the group was just created from this picker. */
  created: boolean;
  name: string;
}

interface Props {
  groups: GroupDoc[];
  user: User;
  selectedId: string;
  view: GroupPickerView;
  onViewChange: (view: GroupPickerView) => void;
  onPick: (groupId: string, info: PickInfo) => void;
  /** Ignore picks while the caller is still acting on the previous one. */
  busy?: boolean;
}

/** The user's groups as a listbox, plus "New group". Content only: the caller supplies the container and title. */
export default function GroupPicker({ groups, user, selectedId, view, onViewChange, onPick, busy = false }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  // Focus the selected group in the list, or the name field in the create view.
  useEffect(() => {
    if (view === 'create') {
      createRef.current?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    const list = listRef.current;
    (list?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [view]);

  const selected = groups.find((g) => g.id === selectedId);

  if (view === 'create') {
    return (
      <div ref={createRef} className="space-y-3">
        <button type="button" onClick={() => onViewChange('list')} className="btn-ghost -ml-2 px-2">
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to groups
        </button>
        <CreateGroupForm
          user={user}
          defaultCurrency={selected?.currency}
          onCreated={(id, name) => onPick(id, { created: true, name })}
          busy={busy}
        />
      </div>
    );
  }

  function pick(group: GroupDoc) {
    if (busy) return;
    onPick(group.id, { created: false, name: group.name });
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const current = options.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + options.length) % options.length;
      options[next].focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && current !== -1) {
      e.preventDefault();
      pick(groups[current]);
    }
  }

  return (
    <div>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Your groups"
        aria-busy={busy || undefined}
        onKeyDown={onListKeyDown}
        className="space-y-1"
      >
        {groups.map((g, i) => {
          const active = g.id === selectedId;
          const count = g.memberUids.length;
          return (
            <li
              key={g.id}
              role="option"
              aria-selected={active}
              tabIndex={active || (!selected && i === 0) ? 0 : -1}
              onClick={() => pick(g)}
              className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                active ? 'bg-accent-soft' : 'hover:bg-recessed'
              }`}
            >
              <span aria-hidden="true">
                <AvatarStack people={membersOf(g, user.uid)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{g.name}</span>
                <span className="block text-xs text-ink-muted">
                  {count} {count === 1 ? 'person' : 'people'}, {g.currency}
                </span>
              </span>
              {active && <Check size={16} strokeWidth={2} className="shrink-0 text-accent-ink" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5 border-t border-line pt-1.5">
        <button
          type="button"
          onClick={() => onViewChange('create')}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-recessed"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New group
        </button>
      </div>
    </div>
  );
}
