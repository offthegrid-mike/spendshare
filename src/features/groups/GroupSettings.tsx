import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { UserPlus, Trash2, Crown } from 'lucide-react';
import { groupsCol } from '../../lib/converters';
import LoadingButton from '../../components/LoadingButton';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import { formatVersionLabel } from '../../lib/appVersion';
import type { GroupDoc } from '../../types/models';

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'];

interface Props { group: GroupDoc; currentUserUid: string; }

export default function GroupSettings({ group, currentUserUid }: Props) {
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const isOwner = group.ownerUid === currentUserUid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(groupsCol, group.id), { name: name.trim(), currency });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim()) return;
    setAddingMember(true);
    setAddError('');
    try {
      const uid = `manual_${crypto.randomUUID()}`;
      await updateDoc(doc(groupsCol, group.id), {
        [`members.${uid}`]: {
          role: 'member',
          displayName: memberName.trim(),
          email: memberEmail.trim(),
          joinedAt: serverTimestamp(),
          manual: true,
        },
        memberUids: arrayUnion(uid),
      });
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
      await updateDoc(doc(groupsCol, group.id), {
        [`members.${uid}`]: deleteField(),
        memberUids: arrayRemove(uid),
      });
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
    <div className="mx-auto max-w-lg space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Group</h2>
        <form onSubmit={handleSubmit} className="card space-y-4 p-4 sm:p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="field"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </section>

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

      {/* Desktop only — mobile already shows this on the More tab */}
      <p className="hidden px-1 text-center text-xs text-ink-faint lg:block">
        {formatVersionLabel(__APP_COMMIT__, __APP_BUILT_AT__)}
      </p>
    </div>
  );
}
