import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { writeBatch, doc, serverTimestamp, Timestamp, type WithFieldValue } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { monthKey } from '../../lib/month';
import { useCategories } from '../../hooks/useCategories';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';

// Safe navigate: returns a no-op when rendered outside a Router (e.g. in tests)
function useSafeNavigate(): NavigateFunction {
  try {
    return useNavigate();
  } catch {
    return (() => {}) as unknown as NavigateFunction;
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const lineItemSchema = z.object({
  name: z.string().min(1, 'Item name required'),
  categoryId: z.string(),
  amount: z.string().min(1),
  shared: z.boolean(),
});

const schema = z.object({
  date: z.string().min(1, 'Date required'),
  shopName: z.string().min(1, 'Shop name is required'),
  payerUid: z.string().min(1),
  items: z.array(lineItemSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Helper: convert Timestamp seconds to YYYY-MM-DD string for date input
// ---------------------------------------------------------------------------
function timestampToDateString(ts: Timestamp): string {
  const d = new Date(ts.seconds * 1000);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  group: GroupDoc;
  currentUserUid: string;
  expense?: ExpenseDoc;
  items?: ItemDoc[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExpenseEditor({ group, currentUserUid, expense, items }: Props) {
  const navigate = useSafeNavigate();
  const { active: cats } = useCategories(group.id);

  // Build default values for edit mode
  const defaultItems: FormValues['items'] =
    expense && items && items.length > 0
      ? items.map((it) => ({
          name: it.name,
          categoryId: it.categoryId,
          amount: (it.amount / 100).toFixed(2),
          shared: it.shared,
        }))
      : [{ name: '', categoryId: '', amount: '', shared: true }];

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: expense ? timestampToDateString(expense.date) : new Date().toISOString().slice(0, 10),
      shopName: expense?.shopName ?? '',
      payerUid: expense?.payerUid ?? group.memberUids[0] ?? '',
      items: defaultItems,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Watch items for running total
  const watchedItems = useWatch({ control, name: 'items' });
  const totalCents = (watchedItems ?? []).reduce((sum, it) => {
    const c = toCents(it?.amount ?? '0');
    return sum + (isNaN(c) ? 0 : c);
  }, 0);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function onSubmit(data: FormValues) {
    const batch = writeBatch(db);
    const expRef = expense
      ? doc(expensesCol(group.id), expense.id)
      : doc(expensesCol(group.id));

    const expDate = new Date(data.date);
    const month = monthKey(expDate);
    const total = data.items.reduce((s, it) => s + toCents(it.amount), 0);

    batch.set(expRef, {
      groupId: group.id,
      date: Timestamp.fromDate(expDate),
      month,
      shopName: data.shopName,
      payerUid: data.payerUid,
      total,
      itemCount: data.items.length,
      createdByUid: currentUserUid,
      createdAt: expense ? (expense.createdAt ?? serverTimestamp()) : serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as WithFieldValue<ExpenseDoc>);

    // Delete old items before rewriting (edit mode only)
    if (items && items.length > 0) {
      for (const oldItem of items) {
        batch.delete(doc(itemsCol(group.id, expRef.id), oldItem.id));
      }
    }

    for (const it of data.items) {
      const catName = cats.find((c) => c.id === it.categoryId)?.name ?? '';
      const itemRef = doc(itemsCol(group.id, expRef.id));
      batch.set(itemRef, {
        groupId: group.id,
        expenseId: expRef.id,
        month,
        name: it.name,
        categoryId: it.categoryId,
        category: catName,
        amount: toCents(it.amount),
        shared: it.shared,
        payerUid: data.payerUid,
      } as WithFieldValue<ItemDoc>);
    }

    await batch.commit();
    navigate('/');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card mx-auto max-w-lg space-y-4 p-5">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {expense ? 'Edit expense' : 'New expense'}
      </h1>
      {/* Date */}
      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium text-slate-700">
          Date
        </label>
        <input
          id="date"
          type="date"
          {...register('date')}
          className="field"
        />
        {errors.date && <p className="text-rose-600 text-sm">{errors.date.message}</p>}
      </div>

      {/* Shop Name */}
      <div>
        <label htmlFor="shopName" className="mb-1 block text-sm font-medium text-slate-700">
          Shop Name
        </label>
        <input
          id="shopName"
          type="text"
          {...register('shopName')}
          className="field"
        />
        {errors.shopName && (
          <p className="text-rose-600 text-sm">{errors.shopName.message}</p>
        )}
      </div>

      {/* Paid by */}
      <div>
        <label htmlFor="payerUid" className="mb-1 block text-sm font-medium text-slate-700">
          Paid by
        </label>
        <select
          id="payerUid"
          {...register('payerUid')}
          className="field"
        >
          {group.memberUids.map((uid) => (
            <option key={uid} value={uid}>
              {group.members[uid]?.displayName ?? uid}
            </option>
          ))}
        </select>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {/* Item name */}
            <input
              type="text"
              placeholder="Item name"
              {...register(`items.${index}.name`)}
              className="field"
            />
            {errors.items?.[index]?.name && (
              <p className="text-rose-600 text-sm">{errors.items[index].name?.message}</p>
            )}

            {/* Category */}
            <select
              {...register(`items.${index}.categoryId`)}
              className="field"
            >
              <option value="">No category</option>
              {cats.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Amount */}
            <div>
              <label
                htmlFor={`items.${index}.amount`}
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Amount
              </label>
              <input
                id={`items.${index}.amount`}
                type="text"
                inputMode="decimal"
                {...register(`items.${index}.amount`)}
                className="field"
              />
            </div>

            {/* Shared */}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                {...register(`items.${index}.shared`)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
              />
              Shared
            </label>

            {/* Remove row */}
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-sm text-rose-600 hover:underline"
              >
                Remove item
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      <button
        type="button"
        onClick={() => append({ name: '', categoryId: '', amount: '', shared: true })}
        className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      >
        + Add item
      </button>

      {/* Running total */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-right">
        <span className="text-sm text-slate-500">Total</span>
        <span className="text-lg font-bold tabular-nums text-slate-900">{formatMoney(totalCents, group.currency)}</span>
      </div>

      {/* Submit */}
      <button type="submit" className="btn-primary w-full py-2.5">
        {expense ? 'Save changes' : 'Save expense'}
      </button>
    </form>
  );
}
