import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { ChevronLeft, Plus, Search } from 'lucide-react';
import GroupSwitcher from './GroupSwitcher';
import SettingsMenu from './SettingsMenu';
import { paths } from '../lib/paths';
import type { GroupDoc } from '../types/models';

interface Props {
  groups: GroupDoc[];
  user: User;
  /** Show a link back to the Home screen before the household switcher. */
  showHome?: boolean;
}

const SECTIONS = [
  { to: paths.spend, label: 'Expenses', end: true },
  { to: paths.summary, label: 'Summary', end: false },
  { to: paths.income, label: 'Income', end: false },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Desktop command bar (lg and up). */
export default function TopBar({ groups, user, showHome = false }: Props) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Mirror ?q= while on the search page; keep the user's draft otherwise. Adjusting
  // state during render (not in an effect) when the URL query changes.
  const urlQuery = pathname === paths.search ? params.get('q') ?? '' : '';
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [draft, setDraft] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setDraft(urlQuery);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    navigate(q ? `${paths.search}?q=${encodeURIComponent(q)}` : paths.search);
  }

  return (
    <header className="sticky top-0 z-20 hidden h-[60px] items-center gap-3.5 border-b border-line bg-surface px-[18px] lg:flex">
      {showHome && (
        <Link
          to={paths.home}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Home
        </Link>
      )}
      <div className="min-w-0 max-w-[240px]">
        <GroupSwitcher groups={groups} user={user} mode="popover" />
      </div>
      <nav aria-label="Sections" className="flex rounded-full bg-recessed p-[3px]">
        {SECTIONS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <form
        role="search"
        onSubmit={onSubmit}
        className="ml-auto flex h-9 max-w-[420px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-canvas px-2.5 text-ink-faint focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
      >
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search items"
          placeholder="Search items"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="rounded-[5px] border border-line px-1.5 py-px font-mono text-[11px] text-ink-muted">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </form>
      <Link to={paths.newExpense} className="btn-primary">
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        Add expense
      </Link>
      <SettingsMenu />
    </header>
  );
}
