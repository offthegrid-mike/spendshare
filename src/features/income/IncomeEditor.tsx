import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { setDoc, doc } from 'firebase/firestore';
import { Check, AlertCircle } from 'lucide-react';
import { incomeCol } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import type { GroupDoc, IncomeDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  selectedMonth: string;
  income: IncomeDoc[];
}

type FormValues = { amount: string; description: string };

export default function IncomeEditor({ group, currentUserUid, selectedMonth, income }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const existingOwn = income.find((d) => d.uid === currentUserUid);
  const defaultValues: FormValues = {
    amount: existingOwn ? (existingOwn.amount / 100).toFixed(2) : '',
    description: existingOwn?.description ?? '',
  };

  const { register, handleSubmit } = useForm<FormValues>({ defaultValues });

  async function onSubmit(data: FormValues) {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const amount = toCents(data.amount && data.amount !== '' ? data.amount : '0');
      const payload: IncomeDoc = { uid: currentUserUid, month: selectedMonth, amount };
      if (data.description.trim()) payload.description = data.description.trim();
      await setDoc(
        doc(incomeCol(group.id), `${currentUserUid}_${selectedMonth}`),
        payload,
        { merge: true },
      );
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
        <p className="mt-1 text-sm text-slate-500">Record your monthly income to calculate fair expense splits.</p>
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
                const existing = income.find((d) => d.uid === uid);
                return (
                  <li key={uid} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{group.members[uid]?.displayName ?? uid}</p>
                      {existing?.description && (
                        <p className="text-xs text-slate-400">{existing.description}</p>
                      )}
                    </div>
                    <span className="font-semibold text-slate-700">
                      {existing ? formatMoney(existing.amount, group.currency) : '—'}
                    </span>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Amount ({group.currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('amount')}
              className="field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Salary, freelance, rental income…"
              {...register('description')}
              className="field"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || saved}
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
        </form>
      </div>
    </div>
  );
}
