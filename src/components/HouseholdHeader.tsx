import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import GroupSwitcher from './GroupSwitcher';
import MonthControl from './MonthControl';
import { routeInfo } from '../lib/routes';
import { useScrolled } from '../hooks/useScrolled';
import type { GroupDoc } from '../types/models';

interface Props {
  groups: GroupDoc[];
  currentUid: string;
  startMonth: string | null;
}

/** Mobile header (below lg): the household on main sections, a back link + title elsewhere. */
export default function HouseholdHeader({ groups, currentUid, startMonth }: Props) {
  const { pathname } = useLocation();
  const route = routeInfo(pathname);
  const scrolled = useScrolled();

  return (
    <header
      className={`sticky top-0 z-20 border-b bg-canvas lg:hidden ${scrolled ? 'border-line' : 'border-transparent'}`}
    >
      {route.kind === 'secondary' ? (
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            to={route.back}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{route.title}</h1>
        </div>
      ) : (
        <div className="space-y-2 px-4 pb-2.5 pt-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <GroupSwitcher groups={groups} currentUid={currentUid} />
            </div>
            <Link
              to="/search"
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
