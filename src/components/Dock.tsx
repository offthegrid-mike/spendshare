import { NavLink, useLocation } from 'react-router-dom';
import { BarChart2, MoreHorizontal, Plus, ReceiptText, TrendingUp, type LucideIcon } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { isExpenseEditorPath } from '../lib/routes';
import { paths } from '../lib/paths';

function DockLink({ to, label, icon: Icon, end = false }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
          isActive ? 'text-accent-ink' : 'text-ink-muted hover:text-ink'
        }`
      }
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

/** Mobile floating dock (below lg). Hidden on the expense editor pages. */
export default function Dock() {
  const { pathname } = useLocation();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  if (isExpenseEditorPath(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3.5 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex items-center rounded-full border border-line bg-surface px-2 py-1 shadow-pop lg:hidden"
    >
      <DockLink to={paths.spend} end label="Expenses" icon={ReceiptText} />
      <DockLink to={paths.summary} label="Summary" icon={BarChart2} />
      <span className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label="Add expense"
          onClick={openAddSheet}
          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent transition hover:brightness-110 motion-safe:active:scale-95"
        >
          <Plus size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      </span>
      <DockLink to={paths.income} label="Income" icon={TrendingUp} />
      <DockLink to={paths.more} label="More" icon={MoreHorizontal} />
    </nav>
  );
}
