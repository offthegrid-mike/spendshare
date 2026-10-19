import type { User } from 'firebase/auth';
import { Link, Outlet } from 'react-router-dom';
import { CalendarCheck, CalendarDays, ChevronLeft, Settings } from 'lucide-react';
import NavDock from '../../components/NavDock';
import Notice from '../../components/Notice';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useScrolled } from '../../hooks/useScrolled';
import { paths } from '../../lib/paths';
import { WorkProvider } from './WorkContext';
import WorkTopBar from './WorkTopBar';

interface Props { user: User; }

const DOCK_ITEMS = [
  { to: paths.work, label: 'Today', icon: CalendarCheck, end: true },
  { to: paths.workMonth, label: 'Month', icon: CalendarDays },
  { to: paths.workMore, label: 'More', icon: Settings },
];

/**
 * Work shell: below lg a header with a way back Home and the floating dock,
 * from lg the top bar. Only the shell for the current width is rendered, so
 * there is one Home link at a time; the lg: classes still hide each one in CSS.
 */
export default function WorkLayout({ user }: Props) {
  const isDesktop = useIsDesktop();
  const scrolled = useScrolled();

  return (
    <WorkProvider uid={user.uid}>
      <div className="min-h-screen bg-canvas text-ink">
        {isDesktop ? (
          <WorkTopBar />
        ) : (
          <header
            className={`sticky top-0 z-20 border-b bg-canvas lg:hidden ${scrolled ? 'border-line' : 'border-transparent'}`}
          >
            <div className="space-y-1 px-4 pb-2.5 pt-2.5">
              <Link
                to={paths.home}
                className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
              >
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                Home
              </Link>
              <h1 className="text-lg font-semibold tracking-tight text-ink">Work</h1>
            </div>
          </header>
        )}

        <main className="mx-auto px-4 pb-28 pt-4 lg:max-w-[760px] lg:px-8 lg:pb-12 lg:pt-6">
          <Outlet />
        </main>

        {!isDesktop && <NavDock items={DOCK_ITEMS} ariaLabel="Work" />}

        <Notice />
      </div>
    </WorkProvider>
  );
}
