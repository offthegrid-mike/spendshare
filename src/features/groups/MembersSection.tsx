import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { UserPlus, Trash2, Crown } from 'lucide-react';
import { groupsCol } from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import LoadingButton from '../../components/LoadingButton';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import type { GroupDoc } from '../../types/models';

interface Props { group: GroupDoc; currentUserUid: string; }

/** The members list, with removing members and adding one without an account (owner only). Households and trips share it. */
export default function MembersSection({ group, currentUserUid }: Props) {
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const isOwner = group.ownerUid === currentUserUid;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim()) return;
    setAddingMember(true);
    setAddError('');
    try {
      const uid = `manual_${crypto.randomUUID()}`;
      // Not waiting for the server while offline: the change is already in the local cache.
      await settleWrite(updateDoc(doc(groupsCol, group.id), {
        [`members.${uid}`]: {
          role: 'member',
          displayName: memberName.trim(),
          email: memberEmail.trim(),
          joinedAt: serverTimestamp(),
          manual: true,
        },
        memberUids: arrayUnion(uid),
      }));
      setMemberName('');
      setMemberEmail('');
    } catch {
      setAddError('Failed to add member. Please try again.');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(uid: string) {
    setRemoveError('');
    setRemovingIds((prev) => new Set(prev).add(uid));
    try {
      await settleWrite(updateDoc(doc(groupsCol, group.id), {
        [`members.${uid}`]: deleteField(),
        memberUids: arrayRemove(uid),
      }));
    } catch {
      setRemoveError('Failed to remove member. Please try again.');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink">Members</h2>
      <div className="card mb-4 overflow-hidden">
        <ul className="divide-y divide-line">
          {group.memberUids.map((uid) => {
            const member = group.members[uid];
            const isThisOwner = uid === group.ownerUid;
            const canRemove = isOwner && !isThisOwner && uid !== currentUserUid;
            return (
              <li key={uid} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={member?.displayName ?? uid} tone={uid === currentUserUid ? 'me' : 'them'} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{member?.displayName ?? uid}</p>
                    <p className="truncate text-xs text-ink-muted">{member?.email || 'Added manually'}</p>
                  </div>
                  {isThisOwner && (
                    <Chip><Crown size={12} aria-hidden="true" /> Owner</Chip>
                  )}
                </div>
                {canRemove && (
                  <LoadingButton
                    loading={removingIds.has(uid)}
                    // Empty string (not omitted) so LoadingButton's `loadingText ?? children`
                    // shows just the spinner instead of falling back to the Trash2 icon.
                    loadingText=""
                    onClick={() => void handleRemoveMember(uid)}
                    className="rounded-[10px] p-1.5 text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative disabled:cursor-not-allowed disabled:opacity-60"
                    title="Remove member"
                  >
                    <Trash2 size={14} />
                  </LoadingButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {removeError && <p className="mb-2 text-xs text-negative">{removeError}</p>}

      {isOwner && (
        <form onSubmit={handleAddMember} className="card space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <UserPlus size={15} className="text-accent-ink" />
            Add member directly
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Name <span className="text-negative">*</span>
            </label>
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Jane Smith"
              required
              className="field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Email <span className="text-ink-faint">(optional)</span>
            </label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="jane@example.com"
              className="field"
            />
          </div>
          {addError && <p className="text-xs text-negative">{addError}</p>}
          <button
            type="submit"
            disabled={addingMember || !memberName.trim()}
            className="btn-primary w-full"
          >
            <UserPlus size={14} />
            {addingMember ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}
    </section>
  );
}
