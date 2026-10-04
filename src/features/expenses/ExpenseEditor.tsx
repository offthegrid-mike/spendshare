import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { writeBatch, doc, serverTimestamp, Timestamp, type WithFieldValue } from 'firebase/firestore';
import { ChevronDown, ChevronLeft, ChevronUp, CreditCard, Gift, History, ScanLine } from 'lucide-react';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol, suggestionsDocRef } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { collapseWhitespace } from '../../lib/textNormalize';
import { monthKey } from '../../lib/month';
import { useCategories } from '../../hooks/useCategories';
import { useItemSuggestions, writeCache } from '../../hooks/useItemSuggestions';
import { readDraft, writeDraft, clearDraft, isDraftMeaningful, type ExpenseDraftValues } from '../../hooks/useExpenseDraft';
import { computeSuggestionsDelta, computeShopsDelta } from '../../lib/suggestions';
import { computeDiscountCents } from '../../lib/discount';
import type { GroupDoc, ExpenseDoc, ItemDoc, SuggestionsDoc, SuggestionEntry, ShopEntry } from '../../types/models';
import { Link, useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import DatePicker from './DatePicker';
import ShopNameCombobox from './ShopNameCombobox';
import QuickAddBar from './QuickAddBar';
import ItemRow from './ItemRow';
import PayerPicker from './PayerPicker';
import { schema, parseQty, type FormValues } from './expenseForm';
import LoadingButton from '../../components/LoadingButton';
import { scanReceipt, receiptToFormPatch, ReceiptOcrError } from '../../lib/receiptOcr';
import { isSearchReturnState } from '../../lib/routes';

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

function useSafeLocationState(): unknown {
  try {
    return useLocation().state;
  } catch {
    return null;
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
  /** `sheet` inside the mobile Add expense sheet (which shows its own title). */
  variant?: 'page' | 'sheet';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExpenseEditor({ group, currentUserUid, expense, items, onSuccess, variant = 'page' }: Props) {
  const navigate = useSafeNavigate();
  const locationState = useSafeLocationState();
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
  const isSheet = variant === 'sheet';
  const inRouter = useInRouterContext();
  const returnsToSearch = isSearchReturnState(locationState);
  // A new expense autosaves a draft once there is something worth keeping.
  const draftSaved = isNew && isDraftMeaningful(allValues as ExpenseDraftValues);
  const itemCount = (watchedItems ?? []).length;
  const sharedCents = (watchedItems ?? []).reduce((sum, it) => {
    if (!it?.shared) return sum;
    const c = toCents(it.amount ?? '0');
    return sum + (isNaN(c) ? 0 : c) * parseQty(it.quantity);
  }, 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Desktop page header; on phones the app header shows the title, and
          the Add expense sheet has its own. */}
      {!isSheet && (
        <div className="hidden items-center gap-1 lg:flex">
          {inRouter && (
            <Link
              to="/"
              aria-label="Back"
              onClick={(e) => {
                if (!returnsToSearch) return;
                e.preventDefault();
                navigate(-1);
              }}
              className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
            >
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          )}
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {expense ? 'Edit expense' : 'New expense'}
          </h1>
          {draftSaved && <span className="ml-auto text-xs text-ink-muted">Draft saved</span>}
        </div>
      )}

      {/* Resumed draft notice */}
      {draftBannerOpen && (
        <div className="flex items-center gap-3 rounded-[10px] bg-recessed px-3.5 py-2.5">
          <History size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">Resumed your unsaved entry.</p>
          <button
            type="button"
            onClick={handleStartFresh}
            className="shrink-0 text-sm font-medium text-accent-ink hover:underline"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Two columns on desktop; DOM order is the field order, so tab order
          is the same on every screen size. */}
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="space-y-4">
      {/* Scan receipt: OCR prefills the form; the image is not uploaded or stored. */}
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
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-recessed px-4 py-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent-soft"
        >
          <ScanLine size={16} strokeWidth={1.75} aria-hidden="true" />
          Scan receipt
        </LoadingButton>
        {scanError && <p className="mt-1.5 text-sm text-negative">{scanError}</p>}
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date-picker" className="mb-1 block text-sm font-medium text-ink">
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

      {/* Shop name */}
      <div>
        <label htmlFor="shopName" className="mb-1 block text-sm font-medium text-ink">
          Shop name
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
        {errors.shopName && <p className="mt-1 text-sm text-negative">{errors.shopName.message}</p>}
      </div>

      {/* Paid by */}
      <Controller
        control={control}
        name="payerUid"
        render={({ field }) => (
          <PayerPicker group={group} viewerUid={currentUserUid} value={field.value} onChange={field.onChange} />
        )}
      />

      {/* Gift card & discount */}
      <div className="rounded-[10px] border border-line bg-surface">
        <button
          type="button"
          aria-label="Gift card & discount"
          aria-expanded={giftCardOpen}
          onClick={handleGiftCardToggle}
          className="flex w-full items-center justify-between px-3.5 py-3 text-left"
        >
          <span className="flex items-center gap-2">
            <Gift size={16} strokeWidth={1.75} className="text-accent-ink" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">Gift card & discount</span>
            <span className="text-xs text-ink-muted">Optional</span>
          </span>
          {giftCardOpen
            ? <ChevronUp size={16} strokeWidth={1.75} className="text-ink-faint" aria-hidden="true" />
            : <ChevronDown size={16} strokeWidth={1.75} className="text-ink-faint" aria-hidden="true" />}
        </button>
        {giftCardOpen && (
          <div className="space-y-3 border-t border-line px-3.5 pb-3 pt-2.5">
            <div>
              <label htmlFor="giftCardAmount" className="mb-1 block text-sm font-medium text-ink">
                Gift card amount
              </label>
              <input
                id="giftCardAmount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                {...register('giftCardAmount')}
                className="field money"
              />
              {errors.giftCardAmount && (
                <p className="mt-1 text-sm text-negative">{errors.giftCardAmount.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="applyDiscount" className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  id="applyDiscount"
                  type="checkbox"
                  checked={!!watchedApplyDiscount}
                  onChange={(e) => handleApplyDiscountToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
                />
                Apply card discount
              </label>
              {watchedApplyDiscount && (
                <div className="mt-2">
                  <label htmlFor="discountPercent" className="mb-1 block text-sm font-medium text-ink">
                    Discount %
                  </label>
                  <input
                    id="discountPercent"
                    type="text"
                    inputMode="decimal"
                    placeholder="2"
                    {...register('discountPercent')}
                    className="field money"
                  />
                  {errors.discountPercent && (
                    <p className="mt-1 text-sm text-negative">{errors.discountPercent.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      <div className="mt-4 space-y-3 lg:mt-0">
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
          <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
            No items yet. Add your first one above.
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
          <p className="text-sm text-negative">{errors.items.message ?? 'Add at least one item'}</p>
        )}
      </div>

      {/* Totals + Save. Below lg (mobile page and the Add expense sheet) it
          sticks to the bottom, except while the keyboard is up (it would cover
          the field being edited). On desktop it sticks to the bottom of the
          items column. */}
      <div
        data-testid="expense-editor-footer"
        className="space-y-3 group-data-[keyboard=open]/sheet:static group-data-[keyboard=open]/sheet:shadow-none max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-4 max-lg:border-t max-lg:border-line max-lg:bg-surface max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-pop lg:sticky lg:bottom-0 lg:bg-canvas lg:pb-4"
      >
        <div className="space-y-1.5 border-t border-line pt-3 max-lg:border-t-0 max-lg:pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">Receipt total</span>
            <span className="money text-base font-semibold text-ink">
              {formatMoney(totalCents, group.currency)}
            </span>
          </div>
          {gcCents > 0 && afterGiftCardCents < 0 && (
            <p className="text-sm text-negative">Gift card amount exceeds receipt total</p>
          )}
          {gcCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                <Gift size={14} strokeWidth={1.75} aria-hidden="true" />
                Gift card
              </span>
              <span className="money text-sm text-ink">− {formatMoney(gcCents, group.currency)}</span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                <CreditCard size={14} strokeWidth={1.75} aria-hidden="true" />
                Card discount ({displayDiscountPct}%)
              </span>
              <span className="money text-sm text-ink">− {formatMoney(discountCents, group.currency)}</span>
            </div>
          )}
          {(gcCents > 0 || discountCents > 0) && (
            <div className="flex items-center justify-between border-t border-line pt-1.5">
              <span className="text-sm font-semibold text-ink">Paid (to split)</span>
              <span className="money text-lg font-semibold text-ink">
                {formatMoney(netCents, group.currency)}
              </span>
            </div>
          )}
          {itemCount > 0 && (
            <p className="text-xs text-ink-muted">
              {itemCount} item{itemCount === 1 ? '' : 's'}, {formatMoney(sharedCents, group.currency)} shared
            </p>
          )}
        </div>

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText={expense ? 'Saving changes…' : 'Saving…'}
          className="btn-primary h-11 w-full"
        >
          {expense ? 'Save changes' : 'Save expense'}
        </LoadingButton>
      </div>
      </div>
      </div>
    </form>
  );
}
