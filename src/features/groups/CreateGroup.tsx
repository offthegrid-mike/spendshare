import type { User } from 'firebase/auth';
import { useUIStore } from '../../stores/uiStore';
import CreateGroupForm from './CreateGroupForm';

interface Props { user: User; }

/** First run: the user has no groups yet. */
export default function CreateGroup({ user }: Props) {
  const chooseGroup = useUIStore((s) => s.chooseGroup);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Create your first group</h1>
        <p className="mb-5 text-sm text-ink-muted">Pick a name and currency to get started.</p>
        <CreateGroupForm user={user} onCreated={(gid) => chooseGroup(gid)} />
      </div>
    </main>
  );
}
