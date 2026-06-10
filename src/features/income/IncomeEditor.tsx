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
        <h1 className="text-xl font-bold text-gray-900">Income — {selectedMonth}</h1>
        <p className="mt-1 text-sm text-gray-500">Record your monthly income to calculate fair expense splits.</p>
      </div>

      {group.memberUids.filter((uid) => uid !== currentUserUid).length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Other members
          </div>
          <ul className="divide-y divide-gray-50">
            {group.memberUids
              .filter((uid) => uid !== currentUserUid)
              .map((uid) => {
                const existing = income.find((d) => d.uid === uid);
                return (
                  <li key={uid} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{group.members[uid]?.displayName ?? uid}</p>
                      {existing?.description && (
                        <p className="text-xs text-gray-400">{existing.description}</p>
                      )}
                    </div>
                    <span className="font-semibold text-gray-700">
                      {existing ? formatMoney(existing.amount, group.currency) : '—'}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-blue-50 bg-blue-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
          Your income
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Amount ({group.currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('amount')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Salary, freelance, rental income…"
              {...register('description')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || saved}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
