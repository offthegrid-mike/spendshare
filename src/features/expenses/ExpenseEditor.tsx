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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 max-w-lg">
      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">
          Date
        </label>
        <input
          id="date"
          type="date"
          {...register('date')}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
        {errors.date && <p className="text-red-600 text-sm">{errors.date.message}</p>}
      </div>

      {/* Shop Name */}
      <div>
        <label htmlFor="shopName" className="block text-sm font-medium text-gray-700">
          Shop Name
        </label>
        <input
          id="shopName"
          type="text"
          {...register('shopName')}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
        {errors.shopName && (
          <p className="text-red-600 text-sm">{errors.shopName.message}</p>
        )}
      </div>

      {/* Paid by */}
      <div>
        <label htmlFor="payerUid" className="block text-sm font-medium text-gray-700">
          Paid by
        </label>
        <select
          id="payerUid"
          {...register('payerUid')}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
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
          <div key={field.id} className="rounded border border-gray-200 p-3 space-y-2">
            {/* Item name */}
            <input
              type="text"
              placeholder="Item name"
              {...register(`items.${index}.name`)}
              className="block w-full rounded border border-gray-300 px-3 py-2"
            />
            {errors.items?.[index]?.name && (
              <p className="text-red-600 text-sm">{errors.items[index].name?.message}</p>
            )}

            {/* Category */}
            <select
              {...register(`items.${index}.categoryId`)}
              className="block w-full rounded border border-gray-300 px-3 py-2"
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
                className="block text-sm font-medium text-gray-700"
              >
                Amount
              </label>
              <input
                id={`items.${index}.amount`}
                type="text"
                inputMode="decimal"
                {...register(`items.${index}.amount`)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            {/* Shared */}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register(`items.${index}.shared`)} />
              Shared
            </label>

            {/* Remove row */}
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-sm text-red-600 hover:underline"
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
        className="rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
      >
        Add item
      </button>

      {/* Running total */}
      <div className="text-right font-semibold">
        Total: {formatMoney(totalCents, group.currency)}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Save
      </button>
    </form>
  );
}
