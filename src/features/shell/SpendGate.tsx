import type { User } from 'firebase/auth';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import CreateGroup from '../groups/CreateGroup';
import PendingInvites from '../invites/PendingInvites';
import { WORK_ENABLED } from '../../lib/features';
import { paths } from '../../lib/paths';
import type { GroupDoc } from '../../types/models';

interface Props {
  groups: GroupDoc[];
  user: User;
}

/** Every /spend screen needs a group: with none, ask the user to create one before showing the shell. */
export default function SpendGate({ groups, user }: Props) {
  // No groups yet → create one (but still surface pending invites so an
  // invited user with no groups of their own can accept and gain access)
  if (groups.length === 0) {
    return (
      <>
        {/* Home's SpendShare tile lands here, so a Work-only user needs a way back. */}
        {WORK_ENABLED && (
          <div className="mx-auto max-w-sm px-4 pt-6">
            <Link to={paths.home} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              Home
            </Link>
          </div>
        )}
        <div className="mx-auto max-w-sm px-4 pt-8 empty:hidden">
          <PendingInvites user={user} />
        </div>
        <CreateGroup user={user} />
      </>
    );
  }

  return <Layout groups={groups} user={user} />;
}
