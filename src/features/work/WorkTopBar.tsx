import { Link, NavLink } from 'react-router-dom';
import { ChevronLeft, Settings } from 'lucide-react';
import SectionPills from '../../components/SectionPills';
import { paths } from '../../lib/paths';

const SECTIONS = [
  { to: paths.work, label: 'Today', end: true },
  { to: paths.workMonth, label: 'Month', end: false },
  { to: paths.workYear, label: 'Year', end: false },
];

/** Desktop command bar for Work (lg and up). */
export default function WorkTopBar() {
  return (
    <header className="sticky top-0 z-20 hidden h-[60px] items-center gap-3.5 border-b border-line bg-surface px-[18px] lg:flex">
      <Link
        to={paths.home}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Home
      </Link>
      <SectionPills sections={SECTIONS} />
      <NavLink
        to={paths.workMore}
        aria-label="Work settings"
        className={({ isActive }) =>
          `ml-auto grid h-9 w-9 place-items-center rounded-[10px] hover:bg-recessed hover:text-ink ${
            isActive ? 'bg-recessed text-ink' : 'text-ink-muted'
          }`
        }
      >
        <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
      </NavLink>
    </header>
  );
}
