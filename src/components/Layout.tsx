import type { User } from 'firebase/auth';
import { Outlet, useLocation } from 'react-router-dom';
import HouseholdHeader from './HouseholdHeader';
import TopBar from './TopBar';
import Dock from './Dock';
import BottomSheet from './BottomSheet';
import PendingInvites from '../features/invites/PendingInvites';
import ExpenseEditor from '../features/expenses/ExpenseEditor';
import { useGroup } from '../hooks/useGroup';
import { useUIStore } from '../stores/uiStore';
import { monthKey } from '../lib/month';
import { isExpenseEditorPath } from '../lib/routes';
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

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <HouseholdHeader groups={groups} currentUid={user.uid} startMonth={startMonth} />
      <TopBar groups={groups} currentUid={user.uid} startMonth={startMonth} />

      <main
        className={`mx-auto px-4 pt-4 lg:px-8 lg:pb-12 lg:pt-6 ${isEditor ? 'pb-8 lg:max-w-[960px]' : 'pb-28 lg:max-w-[760px]'}`}
      >
        <div className="mb-5 empty:mb-0">
          <PendingInvites user={user} />
        </div>
        <Outlet />
      </main>

      <Dock />

      {/* Add expense bottom sheet (mobile only; BottomSheet is lg:hidden) */}
      <BottomSheet open={addSheetOpen} onClose={closeAddSheet} title="Add expense">
        {group && (
          <ExpenseEditor
            key={addSheetOpen ? 'open' : 'closed'}
            group={group}
            currentUserUid={user.uid}
            onSuccess={closeAddSheet}
          />
        )}
      </BottomSheet>
    </div>
  );
}
