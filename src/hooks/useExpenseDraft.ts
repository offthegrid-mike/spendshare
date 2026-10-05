// Local (per-device) draft persistence for the "New expense" form.
//
// Lets a user resume an unsaved expense entry after navigating away, reloading
// the app, or accidentally closing the tab. Mirrors the localStorage approach
// used by useItemSuggestions. Drafts are per group and only kept for new
// expenses — editing an existing expense is never drafted.

export interface ExpenseDraftItem {
  name: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  shared: boolean;
  remark?: string;
  /** Set when a group change couldn't match this item's category; cleared on pick. */
  categoryUnconfirmed?: boolean;
}

export interface ExpenseDraftValues {
  date: string;
  shopName: string;
  payerUid: string;
  giftCardAmount?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  items: ExpenseDraftItem[];
}

export interface ExpenseDraftRecord {
  values: ExpenseDraftValues;
  /** Name of the group the entry was moved from, when it arrived by a group change. */
  movedFrom?: string;
}

// Drafts older than this are ignored (and treated as absent).
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function draftKey(groupId: string) {
  return `expense_draft_${groupId}`;
}

/**
 * True when the form holds something worth resuming — a shop name, gift card,
 * or any item with a name or amount. An untouched blank form is not meaningful,
 * so we never persist (or offer to resume) an empty draft.
 */
export function isDraftMeaningful(v: ExpenseDraftValues | null | undefined): boolean {
  if (!v) return false;
  if (v.shopName.trim() !== '') return true;
  if ((v.giftCardAmount ?? '').trim() !== '') return true;
  if (v.applyDiscount) return true;
  return v.items.some((it) => it.name.trim() !== '' || it.amount.trim() !== '');
}

export function readDraftRecord(groupId: string): ExpenseDraftRecord | null {
  try {
    const raw = localStorage.getItem(draftKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { values: unknown; savedAt: unknown; movedFrom?: unknown };
    if (typeof parsed.savedAt !== 'number' || isNaN(parsed.savedAt)) return null;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    const values = parsed.values as ExpenseDraftValues;
    if (!values || typeof values !== 'object') return null;
    if (!Array.isArray(values.items)) return null;
    if (typeof values.shopName !== 'string' || typeof values.date !== 'string') return null;
    if (!isDraftMeaningful(values)) return null;
    return typeof parsed.movedFrom === 'string' ? { values, movedFrom: parsed.movedFrom } : { values };
  } catch {
    return null;
  }
}

export function readDraft(groupId: string): ExpenseDraftValues | null {
  return readDraftRecord(groupId)?.values ?? null;
}

export function writeDraft(
  groupId: string,
  values: ExpenseDraftValues,
  meta: { movedFrom?: string } = {},
): void {
  try {
    if (!isDraftMeaningful(values)) {
      clearDraft(groupId);
      return;
    }
    localStorage.setItem(
      draftKey(groupId),
      JSON.stringify({ values, savedAt: Date.now(), ...(meta.movedFrom ? { movedFrom: meta.movedFrom } : {}) }),
    );
  } catch {
    // ignore storage quota / serialization errors
  }
}

export function clearDraft(groupId: string): void {
  try {
    localStorage.removeItem(draftKey(groupId));
  } catch {
    // ignore
  }
}
