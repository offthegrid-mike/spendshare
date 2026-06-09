import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { UserPlus, Trash2, Crown } from 'lucide-react';
import { groupsCol } from '../../lib/converters';
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
    try {
      await updateDoc(doc(groupsCol, group.id), {
        [`members.${uid}`]: deleteField(),
        memberUids: arrayRemove(uid),
      });
    } catch {
      setRemoveError('Failed to remove member. Please try again.');
    }
  }

  return (
    <div className="space-y-8 mx-auto max-w-sm">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Group settings</h2>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Members</h2>
        <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {group.memberUids.map((uid) => {
              const member = group.members[uid];
              const isThisOwner = uid === group.ownerUid;
              const canRemove = isOwner && !isThisOwner && uid !== currentUserUid;
              return (
                <li key={uid} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {(member?.displayName ?? uid)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member?.displayName ?? uid}</p>
                      {member?.email && <p className="text-xs text-gray-400">{member.email}</p>}
                    </div>
                    {isThisOwner && <span title="Owner"><Crown size={13} className="text-amber-500" /></span>}
                    {member?.manual && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        manual
                      </span>
                    )}
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveMember(uid)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {removeError && <p className="mb-2 text-xs text-red-600">{removeError}</p>}

        {isOwner && (
          <form onSubmit={handleAddMember} className="space-y-3 rounded-xl border border-dashed border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <UserPlus size={15} className="text-blue-500" />
              Add member directly
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Jane Smith"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <button
              type="submit"
              disabled={addingMember || !memberName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors disabled:opacity-40"
            >
              <UserPlus size={14} />
              {addingMember ? 'Adding…' : 'Add member'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
