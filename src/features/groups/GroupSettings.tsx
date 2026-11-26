import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { groupsCol } from '../../lib/converters';
import Select from '../../components/ui/Select';
import { formatVersionLabel } from '../../lib/appVersion';
import BackupExport from './BackupExport';
import RebuildSuggestions from './RebuildSuggestions';
import MembersSection from './MembersSection';
import type { GroupDoc } from '../../types/models';

const CURRENCY_OPTIONS = ['AUD', 'USD', 'EUR', 'GBP'].map((c) => ({ value: c, label: c }));

interface Props { group: GroupDoc; currentUserUid: string; }

export default function GroupSettings({ group, currentUserUid }: Props) {
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
            <label id="group-currency-label" className="mb-1.5 block text-sm font-medium text-ink">Currency</label>
            <Select
              aria-labelledby="group-currency-label"
              title="Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCY_OPTIONS}
            />
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

      <MembersSection group={group} currentUserUid={currentUserUid} />

      <RebuildSuggestions groupId={group.id} />

      <BackupExport group={group} />

      {/* Desktop only — mobile already shows this on the More tab */}
      <p className="hidden px-1 text-center text-xs text-ink-faint lg:block">
        {formatVersionLabel(__APP_COMMIT__, __APP_BUILT_AT__)}
      </p>
    </div>
  );
}
