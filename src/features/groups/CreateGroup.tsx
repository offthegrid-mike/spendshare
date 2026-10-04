import { useState } from 'react';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { groupsCol } from '../../lib/converters';
import { seedDefaultCategories } from '../../lib/seedCategories';
import { useUIStore } from '../../stores/uiStore';
import type { User } from 'firebase/auth';

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'];

interface Props { user: User; }

export default function CreateGroup({ user }: Props) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setGroup = useUIStore((s) => s.setGroup);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const now = serverTimestamp();
      const ref = await addDoc(groupsCol, {
        id: '',
        name: name.trim(),
        currency,
        ownerUid: user.uid,
        members: {
          [user.uid]: {
            role: 'owner' as const,
            displayName: user.displayName ?? user.email ?? '',
            email: (user.email ?? '').toLowerCase(),
            joinedAt: now,
          },
        },
        memberUids: [user.uid],
        createdAt: now,
      });
      await seedDefaultCategories(ref.id);
      setGroup(ref.id);
    } catch {
      setError('Failed to create group. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Create your first group</h1>
        <p className="mb-5 text-sm text-ink-muted">Pick a name and currency to get started.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Our Household"
              required
              className="field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="field"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? 'Creating…' : 'Create group'}
          </button>
        </form>
      </div>
    </main>
  );
}
