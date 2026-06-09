import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { db } from '../../lib/firebase';
import { formatMoney } from '../../lib/money';
import { useUIStore } from '../../stores/uiStore';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';

interface Props { group: GroupDoc; }

export default function ExpenseList({ group }: Props) {
  const { selectedMonth } = useUIStore();
  const { expenses, itemsByExpense, loading } = useMonthExpenses(group.id, selectedMonth);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function payerName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  async function handleDelete(exp: ExpenseDoc, items: ItemDoc[]) {
    setDeletingId(exp.id);
    try {
      const { writeBatch, doc, collection } = await import('firebase/firestore');
      const batch = writeBatch(db);
      batch.delete(doc(collection(db, `groups/${group.id}/expenses`), exp.id));
      for (const item of items) {
        batch.delete(doc(collection(db, `groups/${group.id}/expenses/${exp.id}/items`), item.id));
      }
      await batch.commit();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
        <ShoppingBag size={36} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No expenses for {selectedMonth}</p>
        <Link
          to="/expense/new"
          className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Add first expense
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {expenses.map((exp) => {
        const items = itemsByExpense[exp.id] ?? [];
        const isExpanded = expandedId === exp.id;
        const isDeleting = deletingId === exp.id;
        return (
          <div
            key={exp.id}
            className="rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{exp.shopName}</p>
                  <p className="text-xs text-gray-400">
                    {payerName(exp.payerUid)} · {exp.itemCount} item{exp.itemCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-base font-bold text-gray-800">
                  {formatMoney(exp.total, group.currency)}
                </span>
                {isExpanded
                  ? <ChevronUp size={16} className="shrink-0 text-gray-400" />
                  : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
              </button>
              <Link
                to={`/expense/${exp.id}/edit`}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </Link>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete(exp, items)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {isExpanded && items.length > 0 && (
              <ul className="border-t border-gray-100 px-4 py-2 space-y-1">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between text-sm text-gray-600">
                    <span>{it.name}</span>
                    <span className="text-gray-400">{formatMoney(it.amount, group.currency)}</span>
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
