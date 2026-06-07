import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { groupsCol } from '../../lib/converters';
import type { GroupDoc } from '../../types/models';

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'];

interface Props { group: GroupDoc; }

export default function GroupSettings({ group }: Props) {
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="mx-auto max-w-sm p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Group settings</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Group name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
