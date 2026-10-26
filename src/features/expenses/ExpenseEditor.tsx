import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { writeBatch, doc, serverTimestamp, Timestamp, type WithFieldValue } from 'firebase/firestore';
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronUp, CreditCard, Gift, History, ScanLine, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import type { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol } from '../../lib/converters';
import { toCents, formatMoney } from '../../lib/money';
import { collapseWhitespace } from '../../lib/textNormalize';
import { monthKey } from '../../lib/month';
import { useCategories, fetchActiveCategories } from '../../hooks/useCategories';
import { useUIStore } from '../../stores/uiStore';
import { carryEntry } from '../../lib/carryEntry';
import { useItemSuggestions } from '../../hooks/useItemSuggestions';
import { invalidateGroupHistory } from '../../hooks/useAllExpenses';
import { readDraftRecord, writeDraft, clearDraft, isDraftMeaningful, type ExpenseDraftValues } from '../../hooks/useExpenseDraft';
import { stageSuggestionsUpdate } from '../../lib/suggestionsWrite';
import { expenseTags } from '../../lib/suggestions';
import { addTag, cleanTag, removeTag, sharedTags, tagKey } from '../../lib/tags';
import { computeDiscountCents } from '../../lib/discount';
import { paths } from '../../lib/paths';
import type { GroupDoc, ExpenseDoc, ItemDoc } from '../../types/models';
import { Link, useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import DatePicker from './DatePicker';
import ShopNameCombobox from './ShopNameCombobox';
import QuickAddBar from './QuickAddBar';
import TagInput from './TagInput';
import ItemRow from './ItemRow';
import PayerPicker from './PayerPicker';
import GroupChip from './GroupChip';
import GroupPicker, { type GroupPickerView } from '../groups/GroupPicker';
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
  /** The user's groups; with `user`, lets a new expense change group. */
  groups?: GroupDoc[];
  user?: User;
  currentUserUid: string;
  expense?: ExpenseDoc;
  items?: ItemDoc[];
  onSuccess?: () => void;
  /**
   * Makes this a refund of `expense`: a new one prefilled from it, or (with
   * `expense` set) an existing refund being edited. `remaining` caps its total.
   */
  refundOf?: { expense: ExpenseDoc; items: ItemDoc[]; remaining: number };
  /** For a purchase being edited: what has been refunded from it, the floor for its total. */
  refunded?: number;
  /** `sheet` inside the mobile Add expense sheet (which shows its own title). */
  variant?: 'page' | 'sheet';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExpenseEditor({
  group, groups, user, currentUserUid, expense, items, onSuccess, refundOf, refunded = 0, variant = 'page',
}: Props) {
  const navigate = useSafeNavigate();
  const locationState = useSafeLocationState();
  const { active: cats, all: allCats, loading: catsLoading } = useCategories(group.id);
  const [suggestions, shopSuggestions, suggestionsLoaded, tagSuggestions] = useItemSuggestions(group.id);

  const isNew = !expense;
  const refundMode = !!refundOf;
  // The cap as the editor opened: refunds are live, and saving this one would
  // otherwise count it against itself before the save finishes.
  const [refundCap] = useState(refundOf?.remaining ?? 0);
  // Only new expenses are drafted — editing one, or making a refund, is never cached.
  const drafting = isNew && !refundMode;
  // A new refund starts from its original's shop, payer and items.
  const source = expense ?? refundOf?.expense;
  const sourceItems = expense ? items : refundOf?.items;

  const blankDefaults: FormValues = {
    date: expense
      ? new Date(expense.date.seconds * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    shopName: source?.shopName ?? '',
    payerUid: source?.payerUid ?? group.memberUids[0] ?? '',
    giftCardAmount: expense?.giftCardAmount ? (expense.giftCardAmount / 100).toFixed(2) : '',
    applyDiscount: !!expense?.discountPercent,
    discountPercent: expense?.discountPercent != null ? String(expense.discountPercent) : DEFAULT_DISCOUNT_PERCENT,
    items:
      source && sourceItems && sourceItems.length > 0
        ? sourceItems.map((it) => ({
            name: it.name,
            categoryId: it.categoryId,
            // amount is the unit price; fall back to the line total for items
            // saved before quantity existed (their quantity is 1).
            amount: ((it.unitAmount ?? it.amount) / 100).toFixed(2),
            quantity: String(it.quantity ?? 1),
            shared: it.shared,
            remark: it.remark ?? '',
            tags: it.tags ?? [],
          }))
        : [],
    tags: sharedTags(sourceItems ?? []),
  };

  // Load a resumable draft once, on mount, for new expenses. `movedFrom` is set
  // when the entry arrived here by a group change.
  const [restored] = useState(() => (drafting ? readDraftRecord(group.id) : null));
  const restoredDraft = restored?.values ?? null;
  const movedFrom = restored?.movedFrom;
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
        { shopName: getValues('shopName') },
        cats,
      );
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

  // Changing group (new expenses only).
  const chooseGroup = useUIStore((s) => s.chooseGroup);
  const setPageTitle = useUIStore((s) => s.setPageTitle);
  // Refunds are edited at the same route as purchases, so name the page here.
  const editingRefund = refundMode && !isNew;
  useEffect(() => {
    if (!editingRefund) return;
    setPageTitle('Edit refund');
    return () => setPageTitle(null);
  }, [editingRefund, setPageTitle]);
  const canChangeGroup = drafting && !!groups && !!user;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<GroupPickerView>('list');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // Set once the entry is handed to another group: stops the debounced autosave
  // writing it back under this group before the editor remounts, and ignores
  // further picks.
  const handedOffRef = useRef(false);
  const switchingRef = useRef(false);
  // Mirrors handedOffRef for rendering: until the editor remounts for the new
  // group, the old form must not come back (saving would record into it).
  const [handedOff, setHandedOff] = useState(false);
  // The target group already has its own unsaved entry; waiting for the user
  // to confirm replacing it.
  const [pendingReplace, setPendingReplace] = useState<{ id: string; name: string } | null>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  // Cleared on unmount so a move still awaiting the target's categories cannot
  // write drafts or switch the app after the editor is gone.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // After a move, land on Change so keyboard and screen-reader users keep their place.
  // Change only renders once the categories have loaded, so wait for that, once.
  const movedFocusDoneRef = useRef(false);
  useEffect(() => {
    if (!movedFrom || catsLoading || movedFocusDoneRef.current) return;
    movedFocusDoneRef.current = true;
    changeRef.current?.focus();
  }, [movedFrom, catsLoading]);

  function closePicker() {
    if (handedOffRef.current) return;
    flushSync(() => {
      setPickerOpen(false);
      setPickerView('list');
      setSwitchError(null);
      setPendingReplace(null);
    });
    changeRef.current?.focus();
  }

  async function handleGroupChange(targetId: string, opts: { replace?: boolean } = {}) {
    if (handedOffRef.current || switchingRef.current) return;
    if (targetId === group.id) {
      closePicker();
      return;
    }
    setPendingReplace(null);
    const values = getValues();
    if (!isDraftMeaningful(values)) {
      handedOffRef.current = true;
      setHandedOff(true);
      clearDraft(group.id);
      chooseGroup(targetId);
      return;
    }
    if (!opts.replace && readDraftRecord(targetId)) {
      const name = groups?.find((g) => g.id === targetId)?.name ?? 'That group';
      setPendingReplace({ id: targetId, name });
      return;
    }
    switchingRef.current = true;
    setSwitching(true);
    setSwitchError(null);
    try {
      const targetCats = await fetchActiveCategories(targetId);
      if (!mountedRef.current) return;
      const { values: moved } = carryEntry(values, allCats, targetCats, currentUserUid);
      handedOffRef.current = true;
      setHandedOff(true);
      writeDraft(targetId, moved, { movedFrom: group.name });
      // Only drop the old draft once the moved one has landed: storage can fail,
      // and after Replace the target may still hold its previous entry.
      const landed = readDraftRecord(targetId);
      if (landed && JSON.stringify(landed.values) === JSON.stringify(moved)) clearDraft(group.id);
      chooseGroup(targetId);
    } catch {
      setSwitchError("Couldn't load that group. Try again.");
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  }

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
    if (!drafting) return;
    const timer = setTimeout(() => {
      if (handedOffRef.current) return;
      writeDraft(group.id, getValues());
    }, 400);
    return () => clearTimeout(timer);
  }, [allValues, drafting, group.id, getValues]);

  // Discard the restored draft and start from a clean form.
  function handleStartFresh() {
    clearDraft(group.id);
    reset(blankDefaults);
    setGiftCardOpen(false);
    setDraftBannerOpen(false);
  }

  // Live totals
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedTags = useWatch({ control, name: 'tags' });
  const tagNames = tagSuggestions.map((t) => t.name);

  /** Sets the expense-wide tags, adding the new ones to every item and taking removed ones off. */
  function applyExpenseTags(next: string[]) {
    const before = getValues('tags') ?? [];
    const added = next.filter((t) => !before.some((b) => tagKey(b) === tagKey(t)));
    const removed = before.filter((b) => !next.some((t) => tagKey(t) === tagKey(b)));
    setValue('tags', next);
    (getValues('items') ?? []).forEach((item, i) => {
      let tags = item.tags ?? [];
      for (const tag of removed) tags = removeTag(tags, tag);
      for (const tag of added) tags = addTag(tags, tag);
      setValue(`items.${i}.tags`, tags);
    });
  }
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
    // Likewise a refund larger than what is left to refund, or a purchase
    // cut below what has already been refunded from it.
    if (refundMode && total > refundCap) return;
    if (total < refunded) return;

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
      ...(refundOf
        ? { kind: 'refund', refundOf: refundOf.expense.id }
        : {
            ...(giftCardAmountCents !== undefined ? { giftCardAmount: giftCardAmountCents } : {}),
            ...(discountPercentNum !== undefined && !isNaN(discountPercentNum)
              ? { discountPercent: discountPercentNum }
              : {}),
          }),
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
        ...(it.tags && it.tags.length > 0 ? { tags: it.tags.map(cleanTag) } : {}),
        ...(refundOf ? { refund: true } : {}),
      } as WithFieldValue<ItemDoc>);
    }

    // Suggestions delta — only written when the hook has finished loading to avoid
    // overwriting Firestore with a stale [] baseline on fast submits. A refund
    // returns things already counted, so it leaves the suggestions alone.
    if (suggestionsLoaded && !refundMode) {
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
      const oldShop = expense?.shopName?.trim() ?? '';
      const newShop = data.shopName?.trim() ?? '';
      const removedShops = oldShop && oldShop !== newShop ? [oldShop] : [];
      const addedShops = newShop && newShop !== oldShop ? [newShop] : [];
      stageSuggestionsUpdate(
        batch,
        group.id,
        { items: suggestions, shops: shopSuggestions, tags: tagSuggestions },
        { items: oldItemInputs, shops: removedShops, tags: expenseTags(items ?? []) },
        { items: newItemInputs, shops: addedShops, tags: expenseTags(data.items) },
      );
    }

    const committed = batch.commit();
    // Before awaiting: offline, commit() only resolves once the server has it,
    // but the local write is already applied.
    invalidateGroupHistory(group.id);
    await committed;
    clearDraft(group.id);
    navigate(paths.spend);
    onSuccess?.();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isSheet = variant === 'sheet';
  const inRouter = useInRouterContext();
  const returnsToSearch = isSearchReturnState(locationState);
  // A new expense autosaves a draft once there is something worth keeping.
  const draftSaved = drafting && isDraftMeaningful(allValues as ExpenseDraftValues);
  const overRefund = refundMode && totalCents > refundCap;
  const belowRefunded = totalCents < refunded;
  const itemCount = (watchedItems ?? []).length;
  const sharedCents = (watchedItems ?? []).reduce((sum, it) => {
    if (!it?.shared) return sum;
    const c = toCents(it.amount ?? '0');
    return sum + (isNaN(c) ? 0 : c) * parseQty(it.quantity);
  }, 0);

  return (
    <>
      {pickerOpen && groups && user && (
        <div
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              closePicker();
            }
          }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Back to expense"
              onClick={closePicker}
              disabled={handedOff}
              className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink"
            >
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <h2 className="text-base font-semibold text-ink">
              {pickerView === 'list' ? 'Choose group' : 'New group'}
            </h2>
          </div>
          <GroupPicker
            groups={groups}
            user={user}
            selectedId={group.id}
            view={pickerView}
            onViewChange={setPickerView}
            onPick={(id) => void handleGroupChange(id)}
            busy={switching || handedOff}
          />
          {pendingReplace && (
            <div role="alert" className="space-y-2.5 rounded-[10px] bg-recessed px-3.5 py-3">
              <p className="text-sm text-ink">
                {pendingReplace.name} already has an unsaved entry. Replace it with this one?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleGroupChange(pendingReplace.id, { replace: true })}
                >
                  Replace
                </button>
                <button type="button" className="btn-outline" onClick={() => setPendingReplace(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {switchError && <p role="alert" className="text-sm text-negative">{switchError}</p>}
        </div>
      )}
    <form hidden={pickerOpen} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Desktop page header; on phones the app header shows the title, and
          the Add expense sheet has its own. */}
      {!isSheet && (
        <div className="hidden items-center gap-1 lg:flex">
          {inRouter && (
            <Link
              to={paths.spend}
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
            {refundMode ? (expense ? 'Edit refund' : 'Refund') : expense ? 'Edit expense' : 'New expense'}
          </h1>
          {draftSaved && <span className="ml-auto text-xs text-ink-muted">Draft saved</span>}
        </div>
      )}

      <GroupChip
        group={group}
        currentUid={currentUserUid}
        changeRef={changeRef}
        onChange={canChangeGroup && !catsLoading ? () => setPickerOpen(true) : undefined}
      />

      {refundOf && (
        <div role="status" className="flex items-center gap-3 rounded-[10px] bg-recessed px-3.5 py-2.5">
          <Undo2 size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            Refund of {refundOf.expense.shopName},{' '}
            {format(new Date(refundOf.expense.date.seconds * 1000), 'd MMM yyyy')}.{' '}
            {formatMoney(refundCap, group.currency)} left to refund.
          </p>
        </div>
      )}

      {/* Resumed draft notice */}
      {draftBannerOpen && (
        <div role="status" className="flex items-center gap-3 rounded-[10px] bg-recessed px-3.5 py-2.5">
          {movedFrom ? (
            <ArrowLeftRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden="true" />
          ) : (
            <History size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden="true" />
          )}
          <p className="flex-1 text-sm text-ink">
            {movedFrom ? 'Moved your entry here. Paid by reset to you.' : 'Resumed your unsaved entry.'}
          </p>
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
      {/* Scan receipt: OCR prefills the form; the image is not uploaded or stored. Not for refunds. */}
      {!refundMode && (
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
      )}

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

      {/* Tags for every item: added to each item now and to items added later. */}
      <TagInput
        id="expense-tags"
        label="Tags for every item"
        tags={watchedTags ?? []}
        onChange={applyExpenseTags}
        suggestions={tagNames}
        hint="Tag single items from their own row."
      />

      {/* Gift card & discount; a refund has neither. */}
      {!refundMode && (
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
      )}
      </div>

      <div className="mt-4 space-y-3 lg:mt-0">
      {/* Items */}
      <div className="space-y-3">
        <QuickAddBar
          cats={cats}
          suggestions={suggestions}
          onAdd={({ name, categoryId, amount, quantity, shared }) =>
            append({ name, categoryId, amount, quantity, shared, remark: '', tags: getValues('tags') ?? [] })
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
                tagSuggestions={tagNames}
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
            <span className="text-sm text-ink-muted">{refundMode ? 'Refund total' : 'Receipt total'}</span>
            <span className="money text-base font-semibold text-ink">
              {formatMoney(totalCents, group.currency)}
            </span>
          </div>
          {belowRefunded && (
            <p className="text-sm text-negative">
              {formatMoney(refunded, group.currency)} of this expense has been refunded, so its total can't go below that.
            </p>
          )}
          {overRefund && (
            <p className="text-sm text-negative">
              A refund can't be more than the {formatMoney(refundCap, group.currency)} left to refund.
            </p>
          )}
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
          disabled={overRefund || belowRefunded}
          className="btn-primary h-11 w-full"
        >
          {expense ? 'Save changes' : refundMode ? 'Save refund' : 'Save expense'}
        </LoadingButton>
      </div>
      </div>
      </div>
    </form>
    </>
  );
}
