import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { writeBatch, doc, serverTimestamp, Timestamp, type WithFieldValue } from 'firebase/firestore';
import { ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol, suggestionsDocRef } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { monthKey } from '../../lib/month';
import { useCategories } from '../../hooks/useCategories';
import { useItemSuggestions, writeCache } from '../../hooks/useItemSuggestions';
import { readDraft, writeDraft, clearDraft } from '../../hooks/useExpenseDraft';
import { computeSuggestionsDelta, computeShopsDelta } from '../../lib/suggestions';
import type { GroupDoc, ExpenseDoc, ItemDoc, SuggestionsDoc, SuggestionEntry, ShopEntry } from '../../types/models';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import DatePicker from './DatePicker';
import ItemNameCombobox from './ItemNameCombobox';
import ShopNameCombobox from './ShopNameCombobox';
import LoadingButton from '../../components/LoadingButton';

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
  remark: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, 'Date required'),
  shopName: z.string().min(1, 'Shop name is required'),
  payerUid: z.string().min(1),
  giftCardAmount: z.string().optional().refine(
    (v) => !v || !isNaN(parseFloat(v)),
    { message: 'Enter a valid amount' }
  ),
  items: z.array(lineItemSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  group: GroupDoc;
  currentUserUid: string;
  expense?: ExpenseDoc;
  items?: ItemDoc[];
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExpenseEditor({ group, currentUserUid, expense, items, onSuccess }: Props) {
  const navigate = useSafeNavigate();
  const { active: cats } = useCategories(group.id);
  const [suggestions, shopSuggestions, suggestionsLoaded] = useItemSuggestions(group.id);

  // Only new expenses are drafted — editing an existing one is never cached.
  const isNew = !expense;

  const blankDefaults: FormValues = {
    date: expense
      ? new Date(expense.date.seconds * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    shopName: expense?.shopName ?? '',
    payerUid: expense?.payerUid ?? group.memberUids[0] ?? '',
    giftCardAmount: expense?.giftCardAmount ? (expense.giftCardAmount / 100).toFixed(2) : '',
    items:
      expense && items && items.length > 0
        ? items.map((it) => ({
            name: it.name,
            categoryId: it.categoryId,
            amount: (it.amount / 100).toFixed(2),
            shared: it.shared,
            remark: it.remark ?? '',
          }))
        : [{ name: '', categoryId: '', amount: '', shared: true, remark: '' }],
  };

  // Load a resumable draft once, on mount, for new expenses.
  const [restoredDraft] = useState(() => (isNew ? readDraft(group.id) : null));
  const [draftBannerOpen, setDraftBannerOpen] = useState(!!restoredDraft);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: restoredDraft ? { ...blankDefaults, ...restoredDraft } : blankDefaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Enter-to-add: append a blank row and move focus to its Item name field.
  // The new row's index is stashed here, then consumed by the effect below
  // once react-hook-form has rendered the appended row.
  const focusItemIndexRef = useRef<number | null>(null);

  function addItemAndFocus(index: number) {
    const name = getValues(`items.${index}.name`);
    if (!name || !name.trim()) return;
    focusItemIndexRef.current = fields.length;
    append({ name: '', categoryId: '', amount: '', shared: true, remark: '' });
  }

  useEffect(() => {
    if (focusItemIndexRef.current === null) return;
    const el = document.getElementById(`items.${focusItemIndexRef.current}.name`);
    el?.focus();
    focusItemIndexRef.current = null;
  }, [fields.length]);

  // Inline two-click confirm for per-row "Remove item". Only one row can be
  // armed at a time; the armed state resets on blur or after a short timeout.
  const [armedRemoveIndex, setArmedRemoveIndex] = useState<number | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRemoveTimer() {
    if (removeTimerRef.current !== null) {
      clearTimeout(removeTimerRef.current);
      removeTimerRef.current = null;
    }
  }

  function disarmRemove() {
    clearRemoveTimer();
    setArmedRemoveIndex(null);
  }

  function handleRemoveClick(index: number) {
    if (armedRemoveIndex === index) {
      clearRemoveTimer();
      setArmedRemoveIndex(null);
      remove(index);
      return;
    }
    clearRemoveTimer();
    setArmedRemoveIndex(index);
    removeTimerRef.current = setTimeout(() => {
      removeTimerRef.current = null;
      setArmedRemoveIndex(null);
    }, 3000);
  }

  // Clear any pending timer on unmount.
  useEffect(() => clearRemoveTimer, []);

  // Gift card panel state — open by default when the expense (or a restored
  // draft) already carries a gift card amount.
  const [giftCardOpen, setGiftCardOpen] = useState(
    () => !!expense?.giftCardAmount || !!restoredDraft?.giftCardAmount?.trim(),
  );
  const [saving, setSaving] = useState(false);

  function handleGiftCardToggle() {
    if (giftCardOpen) setValue('giftCardAmount', '');
    setGiftCardOpen((o) => !o);
  }

  // Autosave the in-progress form so it can be resumed later. Watches every
  // field and persists (debounced) to localStorage. New expenses only.
  const allValues = useWatch({ control });

  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => {
      writeDraft(group.id, getValues());
    }, 400);
    return () => clearTimeout(timer);
  }, [allValues, isNew, group.id, getValues]);

  // Discard the restored draft and start from a clean form.
  function handleStartFresh() {
    clearDraft(group.id);
    reset(blankDefaults);
    setGiftCardOpen(false);
    setDraftBannerOpen(false);
  }

  // Live totals
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedGiftCard = useWatch({ control, name: 'giftCardAmount' });

  const totalCents = (watchedItems ?? []).reduce((sum, it) => {
    const c = toCents(it?.amount ?? '0');
    return sum + (isNaN(c) ? 0 : c);
  }, 0);

  const gcCents = (() => {
    const v = toCents(watchedGiftCard ?? '0');
    return !isNaN(v) && v > 0 ? v : 0;
  })();

  const netCents = totalCents - gcCents;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function onSubmit(data: FormValues) {
    setSaving(true);
    try {
      await submitExpense(data);
    } finally {
      setSaving(false);
    }
  }

  async function submitExpense(data: FormValues) {
    const batch = writeBatch(db);
    const expRef = expense
      ? doc(expensesCol(group.id), expense.id)
      : doc(expensesCol(group.id));

    const expDate = new Date(data.date);
    const month = monthKey(expDate);
    const total = data.items.reduce((s, it) => s + toCents(it.amount), 0);
    const giftCardAmountCents =
      data.giftCardAmount && data.giftCardAmount.trim() !== ''
        ? toCents(data.giftCardAmount)
        : undefined;

    if (giftCardAmountCents !== undefined && giftCardAmountCents > total) {
      // Caught by live UI warning, but guard at submit too
      return;
    }

    const expenseData = {
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
      ...(giftCardAmountCents !== undefined ? { giftCardAmount: giftCardAmountCents } : {}),
    } as WithFieldValue<ExpenseDoc>;

    batch.set(expRef, expenseData);

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
        ...(it.remark ? { remark: it.remark } : {}),
      } as WithFieldValue<ItemDoc>);
    }

    // Suggestions delta — only written when the hook has finished loading to avoid
    // overwriting Firestore with a stale [] baseline on fast submits.
    let newSuggestions: SuggestionEntry[] | null = null;
    let newShops: ShopEntry[] | null = null;
    if (suggestionsLoaded) {
      const oldItemInputs = (items ?? []).map((it) => ({
        name: it.name,
        categoryId: it.categoryId,
        category: it.category,
      }));
      const newItemInputs = data.items.map((it) => ({
        name: it.name,
        categoryId: it.categoryId,
        category: cats.find((c) => c.id === it.categoryId)?.name ?? '',
      }));
      newSuggestions = computeSuggestionsDelta(suggestions, oldItemInputs, newItemInputs);

      const oldShop = expense?.shopName?.trim() ?? '';
      const newShop = data.shopName?.trim() ?? '';
      const removedShops = oldShop && oldShop !== newShop ? [oldShop] : [];
      const addedShops = newShop && newShop !== oldShop ? [newShop] : [];
      newShops = computeShopsDelta(shopSuggestions, removedShops, addedShops);

      batch.set(suggestionsDocRef(group.id), {
        items: newSuggestions,
        shops: newShops,
        updatedAt: serverTimestamp(),
      } as WithFieldValue<SuggestionsDoc>);
    }

    await batch.commit();
    if (newSuggestions !== null && newShops !== null) writeCache(group.id, newSuggestions, newShops);
    clearDraft(group.id);
    navigate('/');
    onSuccess?.();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card mx-auto max-w-lg space-y-4 p-5">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {expense ? 'Edit expense' : 'New expense'}
      </h1>

      {/* Resumed draft notice */}
      {draftBannerOpen && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Resumed your unsaved entry.
          </p>
          <button
            type="button"
            onClick={handleStartFresh}
            className="shrink-0 text-sm font-medium text-amber-700 underline hover:text-amber-900"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Date */}
      <div>
        <label htmlFor="date-picker" className="mb-1 block text-sm font-medium text-slate-700">
          Date
        </label>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              id="date-picker"
              value={field.value}
              onChange={field.onChange}
              error={errors.date?.message}
            />
          )}
        />
      </div>

      {/* Shop Name */}
      <div>
        <label htmlFor="shopName" className="mb-1 block text-sm font-medium text-slate-700">
          Shop Name
        </label>
        <Controller
          control={control}
          name="shopName"
          render={({ field }) => (
            <ShopNameCombobox
              id="shopName"
              value={field.value ?? ''}
              suggestions={shopSuggestions}
              onChange={field.onChange}
              placeholder="e.g. Woolworths"
            />
          )}
        />
        {errors.shopName && <p className="text-rose-600 text-sm">{errors.shopName.message}</p>}
      </div>

      {/* Paid by */}
      <div>
        <label htmlFor="payerUid" className="mb-1 block text-sm font-medium text-slate-700">
          Paid by
        </label>
        <select id="payerUid" {...register('payerUid')} className="field">
          {group.memberUids.map((uid) => (
            <option key={uid} value={uid}>
              {group.members[uid]?.displayName ?? uid}
            </option>
          ))}
        </select>
      </div>

      {/* Gift card */}
      <div className="rounded-xl border border-slate-200">
        <button
          type="button"
          aria-label="Gift card"
          aria-expanded={giftCardOpen}
          onClick={handleGiftCardToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Gift Card</span>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>
          {giftCardOpen
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {giftCardOpen && (
          <div className="border-t border-slate-100 px-4 pb-3 pt-2">
            <label htmlFor="giftCardAmount" className="mb-1 block text-sm font-medium text-slate-700">
              Gift card amount
            </label>
            <input
              id="giftCardAmount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              {...register('giftCardAmount')}
              className="field"
            />
            {errors.giftCardAmount && (
              <p className="mt-1 text-sm text-rose-600">{errors.giftCardAmount.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {/* Item name */}
            <Controller
              control={control}
              name={`items.${index}.name`}
              render={({ field }) => (
                <ItemNameCombobox
                  id={`items.${index}.name`}
                  value={field.value}
                  suggestions={suggestions}
                  onChange={(name, suggestion) => {
                    field.onChange(name);
                    if (suggestion) {
                      setValue(`items.${index}.categoryId`, suggestion.categoryId);
                    }
                  }}
                  onEnter={() => addItemAndFocus(index)}
                />
              )}
            />
            {errors.items?.[index]?.name && (
              <p className="text-rose-600 text-sm">{errors.items[index].name?.message}</p>
            )}

            {/* Category */}
            <select {...register(`items.${index}.categoryId`)} className="field">
              <option value="">No category</option>
              {cats.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Ignore auto-repeat so a held Enter can't append multiple rows.
                    if (!e.repeat) addItemAndFocus(index);
                  }
                }}
                className="field"
              />
            </div>

            {/* Remark */}
            <div>
              <label
                htmlFor={`items.${index}.remark`}
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Remark{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id={`items.${index}.remark`}
                type="text"
                placeholder="e.g. on sale, for party…"
                {...register(`items.${index}.remark`)}
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

            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveClick(index)}
                onBlur={disarmRemove}
                className="text-sm text-rose-600 hover:underline"
              >
                {armedRemoveIndex === index ? 'Click again to remove' : 'Remove item'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      <button
        type="button"
        onClick={() => append({ name: '', categoryId: '', amount: '', shared: true, remark: '' })}
        className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      >
        + Add item
      </button>

      {/* Totals footer */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Receipt total</span>
          <span className="text-base font-semibold tabular-nums text-slate-700">
            {formatMoney(totalCents, group.currency)}
          </span>
        </div>
        {gcCents > 0 && netCents < 0 && (
          <p className="text-sm text-rose-600">Gift card amount exceeds receipt total</p>
        )}
        {gcCents > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">🎁 Gift card</span>
              <span className="text-sm tabular-nums text-emerald-600">
                − {formatMoney(gcCents, group.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span className="text-sm font-semibold text-slate-700">Paid (to split)</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {formatMoney(netCents, group.currency)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Submit */}
      <LoadingButton
        type="submit"
        loading={saving}
        loadingText={expense ? 'Saving changes…' : 'Saving…'}
        className="btn-primary w-full py-2.5"
      >
        {expense ? 'Save changes' : 'Save expense'}
      </LoadingButton>
    </form>
  );
}
