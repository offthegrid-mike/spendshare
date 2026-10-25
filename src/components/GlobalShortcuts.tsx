import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useShortcut } from '../hooks/useShortcut';
import { useEscape } from '../hooks/useEscape';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useUIStore } from '../stores/uiStore';
import { isExpenseEditorPath, routeInfo } from '../lib/routes';
import { nextMonthKey, prevMonthKey, todayMonthKey } from '../lib/month';
import { paths } from '../lib/paths';
import { SHORTCUTS } from '../lib/shortcuts';

/**
 * Desktop keyboard shortcuts that work across the Spend pages: N for a new
 * expense, ← and → to change month on month pages, and ? for the list of
 * every shortcut. Page-specific ones (the expense list's ↑ ↓ E, search's ⌘K
 * and /) live with their pages.
 */
export default function GlobalShortcuts() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { selectedMonth, setMonth } = useUIStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const route = routeInfo(pathname);
  const monthScoped = route.kind === 'primary' && route.monthScoped;

  useShortcut(['n'], () => { navigate(paths.newExpense); }, {
    enabled: isDesktop && !isExpenseEditorPath(pathname),
  });
  useShortcut(
    ['ArrowLeft', 'ArrowRight'],
    (e) => {
      if (!monthKeysFree()) return false;
      if (e.key === 'ArrowLeft') return void setMonth(prevMonthKey(selectedMonth));
      // Like the month control's Next button, stop at the current month.
      if (selectedMonth >= todayMonthKey()) return false;
      setMonth(nextMonthKey(selectedMonth));
    },
    { enabled: isDesktop && monthScoped },
  );
  useShortcut(['?'], () => setHelpOpen(true), { enabled: isDesktop });

  return <ShortcutsHelp open={isDesktop && helpOpen} onClose={() => setHelpOpen(false)} />;
}

/**
 * ← and → belong to the month only when nothing else wants them: nothing has
 * focus, or the expense list does (it uses ↑ ↓). A focused button, tab or
 * scrollable table keeps its arrows, and a page in a view without a single
 * month (Summary's Year view) opts out with data-no-month-keys.
 */
function monthKeysFree(): boolean {
  if (document.querySelector('[data-no-month-keys]')) return false;
  const focused = document.activeElement;
  return !focused || focused === document.body || focused.closest('[role="listbox"]') !== null;
}

function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscape(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-pop"
      >
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-base font-semibold text-ink">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost h-8 w-8 p-0">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {SHORTCUTS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1.5 text-xs font-medium text-ink-muted">{group.title}</h3>
              <dl className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div key={s.keys.join('+')} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="text-ink">{s.description}</dt>
                    <dd className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-6 rounded-md border border-line bg-recessed px-1.5 py-0.5 text-center font-mono text-xs text-ink"
                        >
                          {k}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
