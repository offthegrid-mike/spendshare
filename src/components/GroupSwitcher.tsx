import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { ChevronsUpDown } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { AvatarStack } from './ui/Avatar';
import BottomSheet from './BottomSheet';
import GroupPicker, { type GroupPickerView, type PickInfo } from '../features/groups/GroupPicker';
import { membersOf } from '../lib/groupMembers';
import { isEditExpensePath } from '../lib/routes';
import { paths } from '../lib/paths';
import type { GroupDoc } from '../types/models';

interface Props {
  groups: GroupDoc[];
  user: User;
  /** `sheet` in the mobile header, `popover` in the desktop top bar. */
  mode: 'sheet' | 'popover';
}

/** Member initials + group name; opens the group picker (switch or create). */
export default function GroupSwitcher({ groups, user, mode }: Props) {
  const selectedGroupId = useUIStore((s) => s.selectedGroupId);
  const chooseGroup = useUIStore((s) => s.chooseGroup);
  const showNotice = useUIStore((s) => s.showNotice);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<GroupPickerView>('list');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Popover: a click outside closes it.
  useEffect(() => {
    if (!open || mode !== 'popover') return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, mode]);

  const group = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  if (!group) return null;

  function close({ refocus }: { refocus: boolean }) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function handlePick(id: string, info: PickInfo) {
    close({ refocus: true });
    if (id === group.id) return;
    chooseGroup(id);
    if (info.created) {
      showNotice({ message: `${info.name} created`, action: { label: 'Invite people', to: paths.groupInvites } });
    }
    // An existing expense belongs to the group it was opened from.
    if (isEditExpensePath(pathname)) navigate(paths.spend);
  }

  const title = view === 'list' ? 'Your groups' : 'New group';
  const picker = (
    <GroupPicker
      groups={groups}
      user={user}
      selectedId={group.id}
      view={view}
      onViewChange={setView}
      onPick={handlePick}
    />
  );

  return (
    <div
      ref={wrapperRef}
      className="relative min-w-0"
      onKeyDown={(e) => {
        if (open && mode === 'popover' && e.key === 'Escape') {
          e.preventDefault();
          close({ refocus: true });
        }
      }}
      onBlur={(e) => {
        // Tabbing out closes the popover. A null relatedTarget (a click on
        // nothing focusable) is left to the outside-click handler.
        const next = e.relatedTarget as Node | null;
        if (open && mode === 'popover' && next && !wrapperRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${group.name}, switch group`}
        onClick={() => {
          if (open) {
            close({ refocus: false });
          } else {
            setView('list');
            setOpen(true);
          }
        }}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-[10px] px-1.5 py-1 font-semibold text-ink hover:bg-recessed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <AvatarStack people={membersOf(group, user.uid)} />
        <span className="truncate">{group.name}</span>
        <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </button>

      {open && mode === 'popover' && (
        <div className="absolute left-0 top-11 z-40 w-80 rounded-[14px] border border-line bg-surface p-2 shadow-pop motion-safe:animate-menu-in">
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-muted">{title}</p>
          {picker}
        </div>
      )}

      {/* Portalled: the sticky header is its own stacking context, which would
          otherwise put the sheet under the dock. */}
      {mode === 'sheet' &&
        createPortal(
          <BottomSheet open={open} onClose={() => close({ refocus: true })} title={title}>
            {picker}
          </BottomSheet>,
          document.body,
        )}
    </div>
  );
}
