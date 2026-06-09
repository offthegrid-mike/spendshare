import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { formatMoney } from '../../lib/money';
import { useUIStore } from '../../stores/uiStore';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
}

export default function ExpenseList({ group }: Props) {
  const { selectedMonth } = useUIStore();
  const { expenses, itemsByExpense, loading } = useMonthExpenses(group.id, selectedMonth);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function payerName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  async function handleDelete(exp: ExpenseDoc, items: ItemDoc[]) {
    const { writeBatch, doc, collection } = await import('firebase/firestore');
    const batch = writeBatch(db);
    batch.delete(doc(collection(db, `groups/${group.id}/expenses`), exp.id));
    for (const item of items) {
      batch.delete(doc(collection(db, `groups/${group.id}/expenses/${exp.id}/items`), item.id));
    }
    await batch.commit();
  }

  if (!loading && expenses.length === 0) {
    return <p>No expenses for this month.</p>;
  }

  return (
    <div className="space-y-2">
      {expenses.map((exp) => {
        const items = itemsByExpense[exp.id] ?? [];
        const isExpanded = expandedId === exp.id;
        return (
          <div key={exp.id} className="rounded border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                className="flex-1 text-left font-medium text-gray-900 hover:text-blue-600"
              >
                {exp.shopName}
              </button>
              <span className="text-sm text-gray-500">{payerName(exp.payerUid)}</span>
              <span className="text-sm font-medium">{formatMoney(exp.total, group.currency)} · {exp.itemCount}</span>
              <Link
                to={`/expense/${exp.id}/edit`}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(exp, items)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
            {isExpanded && (
              <ul className="mt-2 space-y-1 pl-4">
                {items.map((it) => (
                  <li key={it.id} className="text-sm text-gray-700">
                    {it.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
