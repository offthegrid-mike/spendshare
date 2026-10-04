import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { UserPlus, Trash2, Crown } from 'lucide-react';
import { groupsCol } from '../../lib/converters';
import LoadingButton from '../../components/LoadingButton';
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
    <div className="space-y-8 mx-auto max-w-sm">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Group settings</h2>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="field"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Members</h2>
        <div className="mb-4 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-50">
            {group.memberUids.map((uid) => {
              const member = group.members[uid];
              const isThisOwner = uid === group.ownerUid;
              const canRemove = isOwner && !isThisOwner && uid !== currentUserUid;
              return (
                <li key={uid} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                      {(member?.displayName ?? uid)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{member?.displayName ?? uid}</p>
                      {member?.email && <p className="text-xs text-slate-400">{member.email}</p>}
                    </div>
                    {isThisOwner && <span title="Owner"><Crown size={13} className="text-amber-500" /></span>}
                    {member?.manual && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        manual
                      </span>
                    )}
                  </div>
                  {canRemove && (
                    <LoadingButton
                      loading={removingIds.has(uid)}
                      // Empty string (not omitted) so LoadingButton's `loadingText ?? children`
                      // shows just the spinner instead of falling back to the Trash2 icon.
                      loadingText=""
                      onClick={() => void handleRemoveMember(uid)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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

        {removeError && <p className="mb-2 text-xs text-rose-600">{removeError}</p>}

        {isOwner && (
          <form onSubmit={handleAddMember} className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <UserPlus size={15} className="text-brand-500" />
              Add member directly
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Name <span className="text-rose-400">*</span>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Email <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="jane@example.com"
                className="field"
              />
            </div>
            {addError && <p className="text-xs text-rose-600">{addError}</p>}
            <button
              type="submit"
              disabled={addingMember || !memberName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 transition-colors disabled:opacity-40"
            >
              <UserPlus size={14} />
              {addingMember ? 'Adding…' : 'Add member'}
            </button>
          </form>
        )}
      </section>

      {/* Desktop only — mobile already shows this on the More tab */}
      <p className="hidden px-1 text-center text-xs text-slate-400 lg:block">
        {formatVersionLabel(__APP_COMMIT__, __APP_BUILT_AT__)}
      </p>
    </div>
  );
}
