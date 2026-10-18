import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useUIStore } from '../stores/uiStore';
import { THEME_OPTIONS } from '../lib/theme';
import { DARK_MODE_ENABLED } from '../lib/features';
import { initialOf } from '../lib/initials';
import { SPEND_LINKS, type SettingsLink } from '../lib/settingsLinks';

interface SettingsMenuProps {
  /** Manage links at the top of the menu. Defaults to the SpendShare set. */
  links?: SettingsLink[];
  /** When set, the trigger is an initial avatar and the menu opens with the name and email. */
  account?: { name: string; email: string };
}

const MENU_ITEMS = '[role="menuitem"], [role="menuitemradio"]';

const item =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink ' +
  'hover:bg-recessed focus:bg-recessed focus:outline-none';

/** Desktop menu: manage links, appearance and sign out, behind a gear or an account avatar. */
export default function SettingsMenu({ links = SPEND_LINKS, account }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // On open, put focus on the first item (menu button pattern).
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>(MENU_ITEMS)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close({ refocus }: { refocus: boolean }) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close({ refocus: true });
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    const next = current === -1 ? (step === 1 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
    items[next].focus();
  }

  // A hairline only goes between sections that both exist, so an empty `links` leaves no stray divider.
  const hasLinks = links.length > 0;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Tabbing out closes the menu. A null relatedTarget (a click on
        // nothing focusable) is left to the outside-click handler.
        const next = e.relatedTarget as Node | null;
        if (open && next && !wrapperRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={account ? 'Account menu' : 'Settings menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          account
            ? 'grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft/70'
            : 'grid h-9 w-9 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-recessed hover:text-ink'
        }
      >
        {account ? initialOf(account.name) : <Settings size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={account ? 'Account' : 'Settings'}
          className="absolute right-0 top-11 z-40 w-60 rounded-[14px] border border-line bg-surface p-1.5 shadow-pop motion-safe:animate-menu-in"
        >
          {account && (
            <>
              <div className="px-2.5 pb-1 pt-1.5">
                <p className="text-sm font-medium text-ink">{account.name}</p>
                <p className="truncate text-xs text-ink-muted">{account.email}</p>
              </div>
              <hr className="my-1.5 border-line" />
            </>
          )}
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} role="menuitem" className={item} onClick={() => close({ refocus: false })}>
              <Icon size={16} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
              {label}
            </Link>
          ))}
          {DARK_MODE_ENABLED && (
            <>
              {hasLinks && <hr className="my-1.5 border-line" />}
              <div role="group" aria-labelledby="settings-appearance-label">
                <p id="settings-appearance-label" className="px-2.5 pb-1 pt-1.5 text-xs text-ink-muted">Appearance</p>
                <div className="mx-1.5 mb-1.5 flex rounded-full bg-recessed p-[3px]">
                  {THEME_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={theme === o.value}
                      onClick={() => setTheme(o.value)}
                      className={`flex-1 rounded-full py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        theme === o.value ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {(hasLinks || DARK_MODE_ENABLED) && <hr className="my-1.5 border-line" />}
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              close({ refocus: false });
              void signOut(auth);
            }}
          >
            <LogOut size={16} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
