import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { writeBatch, doc, serverTimestamp, Timestamp, type WithFieldValue } from 'firebase/firestore';
import { ChevronDown, ChevronUp, Gift, ScanLine } from 'lucide-react';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol, suggestionsDocRef } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { collapseWhitespace } from '../../lib/textNormalize';
import { monthKey } from '../../lib/month';
import { useCategories } from '../../hooks/useCategories';
import { useItemSuggestions, writeCache } from '../../hooks/useItemSuggestions';
import { readDraft, writeDraft, clearDraft } from '../../hooks/useExpenseDraft';
import { computeSuggestionsDelta, computeShopsDelta } from '../../lib/suggestions';
import { computeDiscountCents } from '../../lib/discount';
import type { GroupDoc, ExpenseDoc, ItemDoc, SuggestionsDoc, SuggestionEntry, ShopEntry } from '../../types/models';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import DatePicker from './DatePicker';
import ShopNameCombobox from './ShopNameCombobox';
import QuickAddBar from './QuickAddBar';
import ItemRow from './ItemRow';
import { schema, parseQty, type FormValues } from './expenseForm';
import LoadingButton from '../../components/LoadingButton';
import { scanReceipt, receiptToFormPatch, ReceiptOcrError } from '../../lib/receiptOcr';

// Default percent shown/applied when "Apply card discount" is first checked
// (typical credit-card cashback rate).
const DEFAULT_DISCOUNT_PERCENT = '2';

function useSafeNavigate(): NavigateFunction {
  try {
    return useNavigate();
  } catch {
    return (() => {}) as unknown as NavigateFunction;
  }
}

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
    applyDiscount: !!expense?.discountPercent,
    discountPercent: expense?.discountPercent != null ? String(expense.discountPercent) : DEFAULT_DISCOUNT_PERCENT,
    items:
      expense && items && items.length > 0
        ? items.map((it) => ({
            name: it.name,
            categoryId: it.categoryId,
            // amount is the unit price; fall back to the line total for items
            // saved before quantity existed (their quantity is 1).
            amount: ((it.unitAmount ?? it.amount) / 100).toFixed(2),
            quantity: String(it.quantity ?? 1),
            shared: it.shared,
            remark: it.remark ?? '',
          }))
        : [],
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

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Receipt scan (OCR) — the picked image is processed in-browser and discarded;
  // it is never uploaded or stored anywhere.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setScanError(null);
    setScanning(true);
    try {
      const parsed = await scanReceipt(file, cats.map((c) => c.name));
      const patch = receiptToFormPatch(
        parsed,
        { date: getValues('date'), shopName: getValues('shopName') },
        cats,
      );
      if (patch.date) setValue('date', patch.date, { shouldValidate: true, shouldDirty: true });
      if (patch.shopName)
        setValue('shopName', patch.shopName, { shouldValidate: true, shouldDirty: true });
      if (patch.items && patch.items.length > 0) replace(patch.items);
    } catch (err) {
      setScanError(
        err instanceof ReceiptOcrError
          ? err.userMessage
          : 'Could not read the receipt. Enter the details manually.',
      );
    } finally {
      setScanning(false);
    }
  }

  function toggleExpanded(fieldId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  // Gift card panel state — open by default when the expense (or a restored
  // draft) already carries a gift card amount or an applied discount.
  const [giftCardOpen, setGiftCardOpen] = useState(
    () =>
      !!expense?.giftCardAmount ||
      !!restoredDraft?.giftCardAmount?.trim() ||
      !!expense?.discountPercent ||
      !!restoredDraft?.applyDiscount,
  );
  const [saving, setSaving] = useState(false);

  function handleGiftCardToggle() {
    if (giftCardOpen) {
      setValue('giftCardAmount', '');
      setValue('applyDiscount', false);
      setValue('discountPercent', '');
    }
    setGiftCardOpen((o) => !o);
  }

  function handleApplyDiscountToggle(checked: boolean) {
    setValue('applyDiscount', checked);
    setValue('discountPercent', checked ? DEFAULT_DISCOUNT_PERCENT : '');
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
  const watchedApplyDiscount = useWatch({ control, name: 'applyDiscount' });
  const watchedDiscountPercent = useWatch({ control, name: 'discountPercent' });

  const totalCents = (watchedItems ?? []).reduce((sum, it) => {
    const c = toCents(it?.amount ?? '0');
    return sum + (isNaN(c) ? 0 : c) * parseQty(it?.quantity);
  }, 0);

  const gcCents = (() => {
    const v = toCents(watchedGiftCard ?? '0');
    return !isNaN(v) && v > 0 ? v : 0;
  })();

  // Gift card is applied first; the percentage discount then applies to
  // whatever's left (see docs/superpowers/specs/2026-09-13-expense-discount-percent-design.md).
  const afterGiftCardCents = totalCents - gcCents;
  const rawDiscountPct = parseFloat(watchedDiscountPercent ?? '');
  const discountCents = watchedApplyDiscount
    ? computeDiscountCents(afterGiftCardCents, rawDiscountPct)
    : 0;
  const netCents = afterGiftCardCents - discountCents;
  // Clamped/sanitized for display so the footer label can never show a
  // percentage (e.g. "150%") that disagrees with the clamped dollar amount
  // computeDiscountCents actually deducted.
  const displayDiscountPct = Math.min(Math.max(rawDiscountPct || 0, 0), 100);

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

  async function submitExpense(rawData: FormValues) {
    const data: FormValues = {
      ...rawData,
      shopName: collapseWhitespace(rawData.shopName),
      items: rawData.items.map((it) => ({ ...it, name: collapseWhitespace(it.name) })),
    };
    const batch = writeBatch(db);
    const expRef = expense
      ? doc(expensesCol(group.id), expense.id)
      : doc(expensesCol(group.id));

    const expDate = new Date(data.date);
    const month = monthKey(expDate);
    // amount is the unit price; a line contributes unitPrice * quantity.
    const total = data.items.reduce((s, it) => s + toCents(it.amount) * parseQty(it.quantity), 0);
    const giftCardAmountCents =
      data.giftCardAmount && data.giftCardAmount.trim() !== ''
        ? toCents(data.giftCardAmount)
        : undefined;

    if (giftCardAmountCents !== undefined && giftCardAmountCents > total) {
      // Caught by live UI warning, but guard at submit too
      return;
    }

    const discountPercentNum =
      data.applyDiscount && data.discountPercent && data.discountPercent.trim() !== ''
        ? parseFloat(data.discountPercent)
        : undefined;

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
      ...(discountPercentNum !== undefined && !isNaN(discountPercentNum)
        ? { discountPercent: discountPercentNum }
        : {}),
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
      const unit = toCents(it.amount);
      const q = parseQty(it.quantity);
      batch.set(itemRef, {
        groupId: group.id,
        expenseId: expRef.id,
        month,
        name: it.name,
        categoryId: it.categoryId,
        category: catName,
        // amount is the line total (unit * qty) so summaries/settlement are unchanged.
        amount: unit * q,
        quantity: q,
        unitAmount: unit,
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

      {/* Scan receipt — OCR prefills the form; the image is not uploaded or stored. */}
      <div>
        {/* No `capture` attribute: mobile then offers both the camera and the
            photo library / files, instead of jumping straight to the camera. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleReceiptFile}
        />
        <LoadingButton
          loading={scanning}
          loadingText="Scanning receipt…"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 transition hover:border-brand-400 hover:bg-brand-100"
        >
          <ScanLine size={16} />
          Scan receipt
        </LoadingButton>
        {scanError && <p className="mt-1.5 text-sm text-rose-600">{scanError}</p>}
      </div>

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

      {/* Gift card & discount */}
      <div className="rounded-xl border border-slate-200">
        <button
          type="button"
          aria-label="Gift Card & Discount"
          aria-expanded={giftCardOpen}
          onClick={handleGiftCardToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Gift Card & Discount</span>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>
          {giftCardOpen
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {giftCardOpen && (
          <div className="space-y-3 border-t border-slate-100 px-4 pb-3 pt-2">
            <div>
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
            <div>
              <label htmlFor="applyDiscount" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  id="applyDiscount"
                  type="checkbox"
                  checked={!!watchedApplyDiscount}
                  onChange={(e) => handleApplyDiscountToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Apply card discount
              </label>
              {watchedApplyDiscount && (
                <div className="mt-2">
                  <label htmlFor="discountPercent" className="mb-1 block text-sm font-medium text-slate-700">
                    Discount %
                  </label>
                  <input
                    id="discountPercent"
                    type="text"
                    inputMode="decimal"
                    placeholder="2"
                    {...register('discountPercent')}
                    className="field"
                  />
                  {errors.discountPercent && (
                    <p className="mt-1 text-sm text-rose-600">{errors.discountPercent.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        <QuickAddBar
          cats={cats}
          suggestions={suggestions}
          onAdd={({ name, categoryId, amount, quantity, shared }) =>
            append({ name, categoryId, amount, quantity, shared, remark: '' })
          }
        />

        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No items yet — add your first above.
          </p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <ItemRow
                key={field.id}
                index={index}
                control={control}
                register={register}
                setValue={setValue}
                cats={cats}
                suggestions={suggestions}
                summary={watchedItems?.[index]}
                currency={group.currency}
                expanded={expandedIds.has(field.id)}
                onToggle={() => toggleExpanded(field.id)}
                onRemove={() => {
                  remove(index);
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(field.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        )}

        {errors.items && (
          <p className="text-sm text-rose-600">{errors.items.message ?? 'Add at least one item'}</p>
        )}
      </div>

      {/* Totals + Save footer — sticky to the bottom of the mobile sheet only, and not
          while the keyboard is up (it would cover the field being edited). */}
      <div
        data-testid="expense-editor-footer"
        className="space-y-4 group-data-[keyboard=open]/sheet:static group-data-[keyboard=open]/sheet:shadow-none max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-5 max-sm:border-t max-sm:border-slate-100 max-sm:bg-white max-sm:px-5 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]"
      >
        {/* Totals */}
        <div className="space-y-1.5 border-t border-slate-100 pt-3 max-sm:border-t-0 max-sm:pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Receipt total</span>
            <span className="text-base font-semibold tabular-nums text-slate-700">
              {formatMoney(totalCents, group.currency)}
            </span>
          </div>
          {gcCents > 0 && afterGiftCardCents < 0 && (
            <p className="text-sm text-rose-600">Gift card amount exceeds receipt total</p>
          )}
          {gcCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">🎁 Gift card</span>
              <span className="text-sm tabular-nums text-emerald-600">
                − {formatMoney(gcCents, group.currency)}
              </span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">💳 Card discount ({displayDiscountPct}%)</span>
              <span className="text-sm tabular-nums text-emerald-600">
                − {formatMoney(discountCents, group.currency)}
              </span>
            </div>
          )}
          {(gcCents > 0 || discountCents > 0) && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span className="text-sm font-semibold text-slate-700">Paid (to split)</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {formatMoney(netCents, group.currency)}
              </span>
            </div>
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
      </div>
    </form>
  );
}
