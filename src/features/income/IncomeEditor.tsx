import { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { incomeCol } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { memberName } from '../../lib/balance';
import { monthName } from '../../lib/month';
import Avatar from '../../components/ui/Avatar';
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

  // Re-sync the draft only when *this user's* income actually changes — not on every
  // snapshot fire (e.g. another member saving their income), which would discard an
  // in-progress draft. Adjusted during render (not an effect) per React's
  // "adjusting state on prop change" pattern.
  const myIncomeKey = myIncome.map((d) => `${d.id}:${d.amount}:${d.description ?? ''}`).join('|');
  const [lastSyncedKey, setLastSyncedKey] = useState(myIncomeKey);
  if (myIncomeKey !== lastSyncedKey) {
    setLastSyncedKey(myIncomeKey);
    setEntries(toEntries(myIncome));
  }

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

  const householdTotal = income.reduce((sum, d) => sum + d.amount, 0);
  const others = group.memberUids.filter((uid) => uid !== currentUserUid);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[13px] font-normal text-ink-muted">Household income in {monthName(selectedMonth)}</h1>
        <p data-testid="household-income" className="money text-[32px] font-semibold tracking-[-0.03em] text-ink">
          {formatMoney(householdTotal, group.currency)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">Record your monthly income to calculate fair expense splits.</p>
      </section>

      {others.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink-muted">Other members</h2>
          <ul className="divide-y divide-line">
            {others.map((uid) => {
              const theirIncome = income.filter((d) => d.uid === uid);
              const total = theirIncome.reduce((sum, d) => sum + d.amount, 0);
              return (
                <li key={uid} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Avatar name={memberName(group, uid)} tone="them" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">{memberName(group, uid)}</p>
                      <span className="money font-semibold text-ink">
                        {theirIncome.length > 0 ? formatMoney(total, group.currency) : <span className="text-ink-muted">-</span>}
                      </span>
                    </div>
                    {theirIncome.length > 1 && (
                      <ul className="mt-1 space-y-0.5">
                        {theirIncome.map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-xs text-ink-muted">
                            <span>{d.description || 'Income'}</span>
                            <span className="money">{formatMoney(d.amount, group.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {theirIncome.length === 1 && theirIncome[0].description && (
                      <p className="text-xs text-ink-muted">{theirIncome[0].description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">Your income</h2>
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
                className="field money w-32 shrink-0"
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
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink-muted hover:bg-negative/10 hover:text-negative"
                >
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addEntry}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-recessed hover:text-ink"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            Add income source
          </button>

          {error && (
            <p className="flex items-center gap-2 text-sm text-negative">
              <AlertCircle size={15} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <button type="button" disabled={saving || saved} onClick={onSave} className="btn-primary h-11 w-full">
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>
                <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                Saved
              </>
            ) : (
              'Save income'
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
