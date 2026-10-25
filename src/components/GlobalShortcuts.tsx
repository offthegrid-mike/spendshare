import { useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useShortcut } from '../hooks/useShortcut';
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

  useShortcut(['n', 'N'], () => { navigate(paths.newExpense); }, {
    enabled: isDesktop && !isExpenseEditorPath(pathname),
  });
  useShortcut(['ArrowLeft'], () => setMonth(prevMonthKey(selectedMonth)), { enabled: isDesktop && monthScoped });
  useShortcut(
    ['ArrowRight'],
    () => {
      // Like the month control's Next button, stop at the current month.
      if (selectedMonth >= todayMonthKey()) return false;
      setMonth(nextMonthKey(selectedMonth));
    },
    { enabled: isDesktop && monthScoped },
  );
  useShortcut(['?'], () => setHelpOpen(true), { enabled: isDesktop });

  return <ShortcutsHelp open={isDesktop && helpOpen} onClose={() => setHelpOpen(false)} />;
}

function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  });
  useEffect(() => {
    if (!open) return;
    const listener = (e: KeyboardEvent) => onEscape(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [open]);

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
