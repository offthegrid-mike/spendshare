import { useLocation } from 'react-router-dom';
import { BarChart2, MoreHorizontal, Plus, ReceiptText, TrendingUp } from 'lucide-react';
import NavDock, { type NavDockItem } from './NavDock';
import { useUIStore } from '../stores/uiStore';
import { isExpenseEditorPath } from '../lib/routes';
import { paths } from '../lib/paths';

const ITEMS: NavDockItem[] = [
  { to: paths.spend, label: 'Expenses', icon: ReceiptText, end: true },
  { to: paths.summary, label: 'Summary', icon: BarChart2 },
  { to: paths.income, label: 'Income', icon: TrendingUp },
  { to: paths.more, label: 'More', icon: MoreHorizontal },
];

/** Mobile floating dock (below lg). Hidden on the expense editor pages. */
export default function Dock() {
  const { pathname } = useLocation();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  if (isExpenseEditorPath(pathname)) return null;

  return (
    <NavDock
      items={ITEMS}
      center={{
        index: 2,
        node: (
          <button
            type="button"
            aria-label="Add expense"
            onClick={openAddSheet}
            className="grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent transition hover:brightness-110 motion-safe:active:scale-95"
          >
            <Plus size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        ),
      }}
    />
  );
}
