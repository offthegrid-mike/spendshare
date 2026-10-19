import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface NavDockItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface Props {
  items: NavDockItem[];
  /** A node (the Add button) placed so it ends up at `index` among the rendered children. */
  center?: { index: number; node: ReactNode };
  ariaLabel?: string;
}

function DockLink({ to, label, icon: Icon, end = false }: NavDockItem) {
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

/** Mobile floating dock (below lg): the items in order, with an optional centre node. */
export default function NavDock({ items, center, ariaLabel = 'Main' }: Props) {
  const children = items.map((item) => <DockLink key={item.to} {...item} />);
  if (center) {
    children.splice(
      center.index,
      0,
      <span key="center" className="flex flex-1 justify-center">
        {center.node}
      </span>,
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-3.5 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex items-center rounded-full border border-line bg-surface px-2 py-1 shadow-pop lg:hidden"
    >
      {children}
    </nav>
  );
}
