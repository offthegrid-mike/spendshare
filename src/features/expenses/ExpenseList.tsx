import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Plus, ShoppingBasket } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../lib/firebase';
import { computeAdjustment } from '../../lib/adjustment';
import { settlementEventText } from '../../lib/balance';
import { monthName } from '../../lib/month';
import { useUIStore } from '../../stores/uiStore';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/ui/Skeleton';
import BalanceHero from './BalanceHero';
import ExpenseRow from './ExpenseRow';
import ExpenseDetail from './ExpenseDetail';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';

interface Props { group: GroupDoc; currentUserUid: string; }

interface DayGroup { key: string; label: string; total: number; exps: ExpenseDoc[]; }

const plain = (cents: number) => (cents / 100).toFixed(2);

function groupByDay(expenses: ExpenseDoc[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const exp of expenses) {
    const date = exp.date?.toDate?.();
    const key = date ? format(date, 'yyyy-MM-dd') : 'no-date';
    const net = computeAdjustment(exp).net;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.exps.push(exp);
      last.total += net;
    } else {
      groups.push({ key, label: date ? format(date, 'EEE d MMM') : '', total: net, exps: [exp] });
    }
  }
  return groups;
}

/** Typing in a field must not move the list selection. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading expenses" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {[0, 1].map((day) => (
        <div key={day} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="card divide-y divide-line">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-3 px-3.5 py-3">
                <Skeleton className="h-[38px] w-[38px] rounded-[10px]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExpenseList({ group, currentUserUid }: Props) {
  const { selectedMonth, openAddSheet } = useUIStore();
  const isDesktop = useIsDesktop();
  const { expenses, itemsByExpense, loading, itemsLoading } = useMonthExpenses(group.id, selectedMonth);
  const { settlements, loading: settlementsLoading } = useSettlements(group.id, selectedMonth);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exp: ExpenseDoc; items: ItemDoc[] } | null>(null);

  // Desktop selection: the chosen expense while it exists in this month,
  // otherwise the first one (on load, after a month change or a delete).
  const activeId = expenses.some((e) => e.id === selectedId) ? selectedId : expenses[0]?.id ?? null;
  const active = expenses.find((e) => e.id === activeId) ?? null;

  useEffect(() => {
    if (!isDesktop) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      // Another control (the gear menu, say) already used the key, or a
      // dialog is open on top of the list.
      if (e.defaultPrevented || pendingDelete || document.querySelector('[aria-modal="true"]')) return;
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (expenses.length === 0) return;
      e.preventDefault();
      const i = expenses.findIndex((x) => x.id === activeId);
      const next = expenses[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), expenses.length - 1)];
      setSelectedId(next.id);
      const row = document.querySelector<HTMLElement>(`[data-expense-id="${next.id}"]`);
      // Keep keyboard focus on the selected option when the list has focus;
      // otherwise just bring it into view without stealing focus.
      if (document.activeElement?.closest('[role="listbox"]')) row?.focus();
      else row?.scrollIntoView?.({ block: 'nearest' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, expenses, activeId, pendingDelete]);

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

  if (loading || itemsLoading || settlementsLoading) return <ListSkeleton />;

  const allItems = Object.values(itemsByExpense).flat();
  const paidSettlements = settlements.filter((s) => s.paid);
  const days = groupByDay(expenses);
  const itemsOf = (exp: ExpenseDoc) => itemsByExpense[exp.id] ?? [];

  const list = (
    <div className="space-y-1">
      <BalanceHero
        group={group}
        viewerUid={currentUserUid}
        month={selectedMonth}
        items={allItems}
        settlements={settlements}
      />

      {paidSettlements.map((s) => (
        <div key={s.id} className="flex justify-center pt-4">
          <span className="flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1.5 text-xs text-ink-muted">
            <CircleCheck size={14} strokeWidth={1.75} className="text-accent-ink" aria-hidden="true" />
            {settlementEventText(s, currentUserUid, group, group.currency)}
          </span>
        </div>
      ))}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-recessed text-ink-muted">
            <ShoppingBasket size={26} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">No expenses in {monthName(selectedMonth)} yet</p>
          {isDesktop ? (
            <Link to="/expense/new" className="btn-primary">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Add expense
            </Link>
          ) : (
            <button type="button" className="btn-primary" onClick={openAddSheet}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Add expense
            </button>
          )}
        </div>
      ) : (
        days.map((day) => (
          <div key={day.key}>
            <div className="flex justify-between px-1.5 pb-[7px] pt-[18px] text-xs font-medium text-ink-muted">
              <span>{day.label}</span>
              <span className="money">{plain(day.total)}</span>
            </div>
            <div
              className="card divide-y divide-line overflow-hidden"
              {...(isDesktop ? { role: 'listbox', 'aria-label': day.label || 'Expenses' } : {})}
            >
              {day.exps.map((exp) =>
                isDesktop ? (
                  <ExpenseRow
                    key={exp.id}
                    mode="option"
                    expense={exp}
                    items={itemsOf(exp)}
                    group={group}
                    viewerUid={currentUserUid}
                    selected={exp.id === activeId}
                    onSelect={() => setSelectedId(exp.id)}
                  />
                ) : (
                  <ExpenseRow
                    key={exp.id}
                    mode="disclosure"
                    expense={exp}
                    items={itemsOf(exp)}
                    group={group}
                    viewerUid={currentUserUid}
                    expanded={expandedId === exp.id}
                    onToggle={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                    onDelete={() => setPendingDelete({ exp, items: itemsOf(exp) })}
                    deleting={deletingId === exp.id}
                  />
                ),
              )}
            </div>
          </div>
        ))
      )}

      {deleteError && <p className="pt-2 text-sm text-negative">{deleteError}</p>}
    </div>
  );

  return (
    <>
      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 px-8 pb-12 pt-[22px]">
            <div className="mx-auto max-w-[760px]">{list}</div>
          </div>
          <aside
            aria-label="Expense detail"
            className="sticky top-[60px] flex h-[calc(100dvh-60px)] flex-col overflow-y-auto border-l border-line bg-surface p-[22px]"
          >
            <ExpenseDetail
              expense={active}
              items={active ? itemsOf(active) : []}
              group={group}
              viewerUid={currentUserUid}
              onDelete={() => active && setPendingDelete({ exp: active, items: itemsOf(active) })}
              deleting={active !== null && deletingId === active.id}
            />
          </aside>
        </div>
      ) : (
        list
      )}
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
    </>
  );
}
