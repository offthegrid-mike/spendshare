import type { User } from 'firebase/auth';
import { Outlet, useLocation } from 'react-router-dom';
import HouseholdHeader from './HouseholdHeader';
import TopBar from './TopBar';
import Dock from './Dock';
import MonthRail from './MonthRail';
import BottomSheet from './BottomSheet';
import PendingInvites from '../features/invites/PendingInvites';
import ExpenseEditor from '../features/expenses/ExpenseEditor';
import { useGroup } from '../hooks/useGroup';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useUIStore } from '../stores/uiStore';
import { monthKey } from '../lib/month';
import { isExpenseEditorPath, routeInfo } from '../lib/routes';
import type { GroupDoc } from '../types/models';

interface Props { groups: GroupDoc[]; user: User; }

/**
 * App shell. Both shells are always rendered and one is hidden with CSS:
 * below lg the household header + floating dock, from lg the top bar.
 */
export default function Layout({ groups, user }: Props) {
  const { pathname } = useLocation();
  const { selectedGroupId, addSheetOpen, closeAddSheet } = useUIStore();
  const { group } = useGroup(selectedGroupId);
  // createdAt is null until the server timestamp of a just-created group resolves.
  const createdAt = group?.createdAt?.toDate?.();
  const startMonth = createdAt ? monthKey(createdAt) : null;
  const isEditor = isExpenseEditorPath(pathname);
  const isDesktop = useIsDesktop();
  const route = routeInfo(pathname);
  // Desktop month-scoped pages get the month rail (rendered only on desktop so
  // phones never fetch a year of data for it).
  const showRail = isDesktop && group !== null && route.kind === 'primary' && route.monthScoped;
  // Collapses to nothing (via :empty) when there are no pending invites.
  const invites = (className = 'mb-5 empty:mb-0') => (
    <div className={className}>
      <PendingInvites user={user} />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <HouseholdHeader groups={groups} currentUid={user.uid} startMonth={startMonth} />
      <TopBar groups={groups} currentUid={user.uid} />

      {showRail ? (
        <div className="grid grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="sticky top-[60px] h-[calc(100dvh-60px)] overflow-y-auto border-r border-line px-3 pb-6 pt-4">
            <MonthRail group={group} viewerUid={user.uid} />
          </aside>
          {/* The Expenses home lays out its own list + detail columns. */}
          <main className={pathname === '/' ? 'min-w-0' : 'mx-auto w-full min-w-0 max-w-[760px] px-8 pb-12 pt-6'}>
            {pathname === '/' ? invites('mx-auto max-w-[760px] px-8 pt-4 empty:hidden') : invites()}
            <Outlet />
          </main>
        </div>
      ) : (
        <main
          className={`mx-auto px-4 pt-4 lg:px-8 lg:pb-12 lg:pt-6 ${isEditor ? 'pb-8 lg:max-w-[960px]' : 'pb-28 lg:max-w-[760px]'}`}
        >
          {invites()}
          <Outlet />
        </main>
      )}

      <Dock />

      {/* Add expense bottom sheet (mobile only; BottomSheet is lg:hidden) */}
      <BottomSheet open={addSheetOpen} onClose={closeAddSheet} title="Add expense">
        {group && (
          <ExpenseEditor
            key={addSheetOpen ? 'open' : 'closed'}
            group={group}
            currentUserUid={user.uid}
            onSuccess={closeAddSheet}
            variant="sheet"
          />
        )}
      </BottomSheet>
    </div>
  );
}
