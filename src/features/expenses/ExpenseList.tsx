import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../lib/firebase';
import { formatMoney } from '../../lib/money';
import { useUIStore } from '../../stores/uiStore';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';

interface Props { group: GroupDoc; }

export default function ExpenseList({ group }: Props) {
  const { selectedMonth } = useUIStore();
  const { expenses, itemsByExpense, loading } = useMonthExpenses(group.id, selectedMonth);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exp: ExpenseDoc; items: ItemDoc[] } | null>(null);

  function payerName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  async function handleDelete(exp: ExpenseDoc, items: ItemDoc[]) {
    setDeletingId(exp.id);
    setDeleteError(null);
    try {
      const { writeBatch, doc, collection } = await import('firebase/firestore');
      const batch = writeBatch(db);
      batch.delete(doc(collection(db, `groups/${group.id}/expenses`), exp.id));
      for (const item of items) {
        batch.delete(doc(collection(db, `groups/${group.id}/expenses/${exp.id}/items`), item.id));
      }
      await batch.commit();
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { exp, items } = pendingDelete;
    setPendingDelete(null);
    await handleDelete(exp, items);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/70 shadow-card" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white/70 py-16 text-center backdrop-blur-sm">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-100">
          <ShoppingBag size={28} />
        </div>
        <p className="text-sm font-medium text-slate-500">No expenses for {selectedMonth}</p>
        <Link to="/expense/new" className="btn-primary mt-1">
          Add first expense
        </Link>
      </div>
    );
  }

  // Group expenses by date label for section headers
  const grouped: { label: string; exps: ExpenseDoc[] }[] = [];
  for (const exp of expenses) {
    const label = exp.date
      ? format(exp.date.toDate(), 'MMM d')
      : '';
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) {
      last.exps.push(exp);
    } else {
      grouped.push({ label, exps: [exp] });
    }
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ label, exps }) => (
        <div key={label || 'no-date'}>
          {label && (
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </p>
          )}
          <div className="space-y-2.5">
            {exps.map((exp) => {
              const items = itemsByExpense[exp.id] ?? [];
              const isExpanded = expandedId === exp.id;
              const isDeleting = deletingId === exp.id;
              const primaryCategory = items[0]?.category;
              return (
                <div
                  key={exp.id}
                  className="rounded-2xl border border-white/60 bg-white/80 shadow-card backdrop-blur-sm transition-shadow hover:shadow-card-hover"
                >
                  <div className="flex min-h-[44px] items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                        <ShoppingBag size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{exp.shopName}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-400">
                            {payerName(exp.payerUid)} · {exp.itemCount} item{exp.itemCount !== 1 ? 's' : ''}
                          </p>
                          {primaryCategory && (
                            <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                              {primaryCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {exp.giftCardAmount ? (
                          <>
                            <p className="text-xs tabular-nums text-slate-400 line-through">
                              {formatMoney(exp.total, group.currency)}
                            </p>
                            <p className="text-base font-bold tabular-nums text-emerald-600">
                              {formatMoney(exp.total - exp.giftCardAmount, group.currency)}
                            </p>
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              🎁 Gift card {formatMoney(exp.giftCardAmount, group.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="text-base font-bold tabular-nums text-slate-900">
                            {formatMoney(exp.total, group.currency)}
                          </span>
                        )}
                      </div>
                      {isExpanded
                        ? <ChevronUp size={16} className="shrink-0 text-slate-400" />
                        : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
                    </button>
                    <Link
                      to={`/expense/${exp.id}/edit`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setPendingDelete({ exp, items })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {isExpanded && items.length > 0 && (
                    <ul className="space-y-1 border-t border-slate-100 px-4 py-2.5">
                      {items.map((it) => (
                        <li key={it.id} className="flex items-start justify-between text-sm text-slate-600">
                          <span className="flex flex-col">
                            <span>{it.name}</span>
                            {it.remark && (
                              <span data-testid="item-remark" className="text-xs text-slate-400">
                                {it.remark}
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-slate-400">{formatMoney(it.amount, group.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete expense?"
        message={
          pendingDelete
            ? `This will permanently delete the "${pendingDelete.exp.shopName}" expense and its items. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmDisabled={deletingId !== null}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
