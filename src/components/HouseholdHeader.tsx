import type { User } from 'firebase/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import GroupSwitcher from './GroupSwitcher';
import MonthControl from './MonthControl';
import { isSearchReturnState, routeInfo } from '../lib/routes';
import { paths } from '../lib/paths';
import { useScrolled } from '../hooks/useScrolled';
import { useUIStore } from '../stores/uiStore';
import type { GroupDoc } from '../types/models';

interface Props {
  groups: GroupDoc[];
  user: User;
  startMonth: string | null;
  /** Show a link back to the Home screen above the household switcher. */
  showHome?: boolean;
}

/** Mobile header (below lg): the household on main sections, a back link + title elsewhere. */
export default function HouseholdHeader({ groups, user, startMonth, showHome = false }: Props) {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const route = routeInfo(pathname);
  const pageTitle = useUIStore((s) => s.pageTitle);
  const scrolled = useScrolled();
  const returnsToSearch = isSearchReturnState(location.state);

  function handleBack(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!returnsToSearch) return;
    e.preventDefault();
    navigate(-1);
  }

  return (
    <header
      className={`sticky top-0 z-20 border-b bg-canvas lg:hidden ${scrolled ? 'border-line' : 'border-transparent'}`}
    >
      {route.kind === 'secondary' ? (
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            to={route.back}
            aria-label="Back"
            onClick={handleBack}
            className="grid h-10 w-10 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{pageTitle ?? route.title}</h1>
        </div>
      ) : (
        <div className="space-y-2 px-4 pb-2.5 pt-2.5">
          {showHome && (
            // The padding makes a 40px tap target; the negative margin keeps the layout as it was.
            <Link
              to={paths.home}
              className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-sm font-medium text-ink-muted hover:text-ink"
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              Home
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <GroupSwitcher groups={groups} user={user} mode="sheet" />
            </div>
            <Link
              to={paths.search}
              aria-label="Search"
              className="grid h-10 w-10 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
            >
              <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
          {route.monthScoped && (
            <div className="flex">
              <MonthControl startMonth={startMonth} />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
