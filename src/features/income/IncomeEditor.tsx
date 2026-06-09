import { useForm } from 'react-hook-form';
import { setDoc, doc } from 'firebase/firestore';
import { incomeCol } from '../../lib/converters';
import { toCents } from '../../lib/money';
import type { GroupDoc, IncomeDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  selectedMonth: string;
  income: IncomeDoc[];
}

type FormValues = Record<string, string>;

export default function IncomeEditor({ group, currentUserUid, selectedMonth, income }: Props) {
  const existingOwn = income.find((d) => d.uid === currentUserUid);
  const defaultValues: FormValues = {
    [currentUserUid]: existingOwn ? (existingOwn.amount / 100).toFixed(2) : '',
  };

  const { register, handleSubmit } = useForm<FormValues>({ defaultValues });

  async function onSubmit(data: FormValues) {
    const rawValue = data[currentUserUid];
    const amount = toCents(rawValue && rawValue !== '' ? rawValue : '0');
    await setDoc(
      doc(incomeCol(group.id), `${currentUserUid}_${selectedMonth}`),
      { uid: currentUserUid, month: selectedMonth, amount },
      { merge: true },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 max-w-lg">
      {group.memberUids.map((uid) => {
        const memberName = group.members[uid]?.displayName ?? uid;
        const existing = income.find((d) => d.uid === uid);
        return (
          <div key={uid} className="flex items-center gap-4">
            <span className="w-32">{memberName}</span>
            {uid === currentUserUid ? (
              <input
                type="number"
                step="0.01"
                {...register(uid)}
                className="block w-full rounded border border-gray-300 px-3 py-2"
              />
            ) : (
              <span className="block w-full px-3 py-2 text-gray-700">
                {existing ? (existing.amount / 100).toFixed(2) : '—'}
              </span>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Save
      </button>
    </form>
  );
}
