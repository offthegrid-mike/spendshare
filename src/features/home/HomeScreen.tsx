import type { User } from 'firebase/auth';
import BrandMark from '../../components/BrandMark';
import Notice from '../../components/Notice';
import SettingsMenu from '../../components/SettingsMenu';
import { useWorkClock } from '../../hooks/useWorkClock';
import { firstNameOf, greeting, longDate } from '../../lib/greeting';
import PendingInvites from '../invites/PendingInvites';
import SpendTile from './SpendTile';
import WorkTile from './WorkTile';
import type { GroupDoc } from '../../types/models';

interface Props {
  user: User;
  groups: GroupDoc[];
  /** The selected household; null while it loads or when there is none. */
  group: GroupDoc | null;
}

/** The screen after sign-in: a greeting, any pending invites, and a tile for each side of the app. */
export default function HomeScreen({ user, groups, group }: Props) {
  // The Work clock ticks each minute (and on returning to the tab), so a Home
  // screen left open overnight greets the new morning with the new date.
  const clock = useWorkClock();
  const firstName = firstNameOf(user.displayName, user.email);

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <div className="mx-auto max-w-[960px] px-4 lg:px-0">
        <header className="flex items-center justify-between py-3 lg:py-4">
          <div className="flex items-center gap-2.5 text-base font-semibold text-ink">
            <BrandMark size="sm" />
            Home
          </div>
          <SettingsMenu links={[]} account={{ name: user.displayName?.trim() || firstName, email: user.email ?? '' }} />
        </header>
        <main>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
            {greeting(Math.floor(clock.nowMinutes / 60), firstName)}
          </h1>
          <p className="mb-4 mt-0.5 text-[13px] text-ink-muted">{longDate(clock.today)}</p>
          <div className="mb-4 empty:hidden">
            <PendingInvites user={user} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SpendTile groups={groups} group={group} viewerUid={user.uid} />
            <WorkTile uid={user.uid} />
          </div>
        </main>
      </div>
      <Notice />
    </div>
  );
}
