import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, Plus, ShoppingBasket } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../lib/firebase';
import { stageSuggestionsUpdate } from '../../lib/suggestionsWrite';
import { computeAdjustment } from '../../lib/adjustment';
import { settlementEventText } from '../../lib/balance';
import { formatMoney } from '../../lib/money';
import { monthName } from '../../lib/month';
import { paths } from '../../lib/paths';
import { useUIStore } from '../../stores/uiStore';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useItemSuggestions } from '../../hooks/useItemSuggestions';
import { invalidateGroupHistory } from '../../hooks/useAllExpenses';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useShortcut } from '../../hooks/useShortcut';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/ui/Skeleton';
import BalanceHero from './BalanceHero';
import CategoryFilter from './CategoryFilter';
import { categoriesBySpend, filterByCategory } from './filterByCategory';
import ExpenseRow from './ExpenseRow';
import ExpenseDetail from './ExpenseDetail';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';

interface Props { group: GroupDoc; currentUserUid: string; }

interface DayGroup { key: string; label: string; total: number; exps: ExpenseDoc[]; }

const plain = (cents: number) => (cents / 100).toFixed(2);

/** Groups newest-first expenses by day; `amountOf` is what each adds to its day's total. */
function groupByDay(expenses: ExpenseDoc[], amountOf: (exp: ExpenseDoc) => number): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const exp of expenses) {
    const date = exp.date?.toDate?.();
    const key = date ? format(date, 'yyyy-MM-dd') : 'no-date';
    const net = amountOf(exp);
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
  const navigate = useNavigate();
  const { expenses, itemsByExpense, loading, itemsLoading } = useMonthExpenses(group.id, selectedMonth);
  const { settlements, loading: settlementsLoading } = useSettlements(group.id, selectedMonth);
  const [suggestions, shopSuggestions, suggestionsLoaded] = useItemSuggestions(group.id);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exp: ExpenseDoc; items: ItemDoc[] } | null>(null);
  const [filter, setFilter] = useState<{ groupId: string; month: string; category: string } | null>(null);

  const allItems = useMemo(() => Object.values(itemsByExpense).flat(), [itemsByExpense]);
  const categoryNames = useMemo(() => categoriesBySpend(allItems), [allItems]);
  // A filter applies while its group and month are showing and the month
  // still has its category alongside another (with one category the chips
  // are gone, so there is no way back to All).
  const category =
    filter?.groupId === group.id &&
    filter.month === selectedMonth &&
    categoryNames.length > 1 &&
    categoryNames.includes(filter.category)
      ? filter.category
      : null;
  // Once it stops applying it is dropped for good, so going back to the month,
  // the group or the category does not quietly bring it back. Adjusting state
  // during render, not in an effect; skipped while loading, when the month's
  // categories are not known yet.
  if (filter && !category && !loading && !itemsLoading) setFilter(null);
  const filtered = useMemo(
    () => (category ? filterByCategory(expenses, itemsByExpense, category) : null),
    [category, expenses, itemsByExpense],
  );
  const visible = filtered?.expenses ?? expenses;

  // Desktop selection: the chosen expense while it is listed, otherwise the
  // first one (on load, after a month change, a filter change or a delete).
  const activeId = visible.some((e) => e.id === selectedId) ? selectedId : visible[0]?.id ?? null;
  const active = visible.find((e) => e.id === activeId) ?? null;

  // Desktop list keys. useShortcut skips keys another control (the gear menu,
  // say) already used, keys typed in a field, and keys under an open dialog.
  const listKeys = { enabled: isDesktop && !pendingDelete && visible.length > 0 };
  useShortcut(['e', 'E'], () => {
    if (activeId) navigate(paths.editExpense(activeId));
  }, listKeys);
  useShortcut(['ArrowDown', 'ArrowUp'], (e) => {
    const i = visible.findIndex((x) => x.id === activeId);
    const next = visible[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), visible.length - 1)];
    setSelectedId(next.id);
    const row = document.querySelector<HTMLElement>(`[data-expense-id="${next.id}"]`);
    // Keep keyboard focus on the selected option when the list has focus;
    // otherwise just bring it into view without stealing focus.
    if (document.activeElement?.closest('[role="listbox"]')) row?.focus();
    else row?.scrollIntoView?.({ block: 'nearest' });
  }, listKeys);

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
      // Take the deleted names out of the suggestions, as the editor does on save.
      // Skipped until they have loaded, so a stale [] baseline never overwrites them.
      if (suggestionsLoaded) {
        const shop = exp.shopName?.trim() ?? '';
        stageSuggestionsUpdate(
          batch,
          group.id,
          { items: suggestions, shops: shopSuggestions },
          { items, shops: shop ? [shop] : [] },
          { items: [], shops: [] },
        );
      }
      const committed = batch.commit();
      // Before awaiting: offline, commit() only resolves once the server has it.
      invalidateGroupHistory(group.id);
      await committed;
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

  const paidSettlements = settlements.filter((s) => s.paid);
  const days = groupByDay(visible, (exp) => (filtered ? filtered.paidOf[exp.id] : computeAdjustment(exp).net));
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

      <CategoryFilter
        categories={categoryNames}
        selected={category}
        onSelect={(c) => setFilter(c ? { groupId: group.id, month: selectedMonth, category: c } : null)}
      />

      {filtered && category && (
        <p data-testid="category-filter-summary" className="px-1.5 pt-3 text-[13px] text-ink-muted">
          <span className="font-medium text-ink">{category}</span>
          {' · '}
          <span className="money text-ink">{formatMoney(filtered.total, group.currency)}</span>
          {' · '}
          {filtered.expenses.length} {filtered.expenses.length === 1 ? 'expense' : 'expenses'}
        </p>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-recessed text-ink-muted">
            <ShoppingBasket size={26} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">No expenses in {monthName(selectedMonth)} yet</p>
          {isDesktop ? (
            <Link to={paths.newExpense} className="btn-primary">
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
                    category={category ?? undefined}
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
                    category={category ?? undefined}
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
              category={category ?? undefined}
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
