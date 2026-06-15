import { useState, useEffect } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { Check, AlertCircle, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { incomeCol } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import type { GroupDoc, IncomeDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  selectedMonth: string;
  income: IncomeDoc[];
}

type EntryDraft = { amount: string; description: string };

function toEntries(docs: IncomeDoc[]): EntryDraft[] {
  if (docs.length === 0) return [{ amount: '', description: '' }];
  return docs.map((d) => ({
    amount: (d.amount / 100).toFixed(2),
    description: d.description ?? '',
  }));
}

export default function IncomeEditor({ group, currentUserUid, selectedMonth, income }: Props) {
  const myIncome = income.filter((d) => d.uid === currentUserUid);
  const [entries, setEntries] = useState<EntryDraft[]>(() => toEntries(myIncome));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEntries(toEntries(income.filter((d) => d.uid === currentUserUid)));
  }, [income, currentUserUid]);

  function updateEntry(index: number, field: keyof EntryDraft, value: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, { amount: '', description: '' }]);
  }

  function removeEntry(index: number) {
    setEntries((prev) =>
      prev.length === 1 ? [{ amount: '', description: '' }] : prev.filter((_, i) => i !== index),
    );
  }

  async function onSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const batch = writeBatch(db);

      for (const d of myIncome) {
        if (d.id) batch.delete(doc(incomeCol(group.id), d.id));
      }

      for (const entry of entries) {
        const amount = toCents(entry.amount && entry.amount !== '' ? entry.amount : '0');
        if (isNaN(amount) || amount <= 0) continue;
        const newRef = doc(incomeCol(group.id));
        const payload: Omit<IncomeDoc, 'id'> = { uid: currentUserUid, month: selectedMonth, amount };
        if (entry.description.trim()) payload.description = entry.description.trim();
        batch.set(newRef, payload);
      }

      await batch.commit();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Income — {selectedMonth}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Record your monthly income to calculate fair expense splits.
        </p>
      </div>

      {group.memberUids.filter((uid) => uid !== currentUserUid).length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Other members
          </div>
          <ul className="divide-y divide-slate-50">
            {group.memberUids
              .filter((uid) => uid !== currentUserUid)
              .map((uid) => {
                const theirIncome = income.filter((d) => d.uid === uid);
                const total = theirIncome.reduce((s, d) => s + d.amount, 0);
                return (
                  <li key={uid} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">
                        {group.members[uid]?.displayName ?? uid}
                      </p>
                      <span className="font-semibold text-slate-700">
                        {theirIncome.length > 0 ? formatMoney(total, group.currency) : '—'}
                      </span>
                    </div>
                    {theirIncome.length > 1 && (
                      <ul className="mt-1 space-y-0.5">
                        {theirIncome.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between text-xs text-slate-400"
                          >
                            <span>{d.description || 'Income'}</span>
                            <span>{formatMoney(d.amount, group.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {theirIncome.length === 1 && theirIncome[0].description && (
                      <p className="text-xs text-slate-400">{theirIncome[0].description}</p>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-brand-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
          Your income
        </div>
        <div className="space-y-3 p-4">
          {entries.map((entry, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={entry.amount}
                onChange={(e) => updateEntry(index, 'amount', e.target.value)}
                className="field w-28 shrink-0"
              />
              <input
                type="text"
                placeholder="e.g. Salary, freelance…"
                value={entry.description}
                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                className="field flex-1"
              />
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  aria-label="Remove income source"
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addEntry}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            + Add income source
          </button>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={saving || saved}
            onClick={onSave}
            className="btn-primary w-full py-2.5"
          >
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>
                <Check size={15} />
                Saved!
              </>
            ) : (
              'Save income'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
