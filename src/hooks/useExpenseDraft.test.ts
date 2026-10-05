import { describe, it, expect, beforeEach } from 'vitest';
import {
  readDraft,
  readDraftRecord,
  writeDraft,
  clearDraft,
  isDraftMeaningful,
  type ExpenseDraftValues,
} from './useExpenseDraft';

function makeDraft(overrides: Partial<ExpenseDraftValues> = {}): ExpenseDraftValues {
  return {
    date: '2026-07-11',
    shopName: 'Woolworths',
    payerUid: 'u1',
    giftCardAmount: '',
    applyDiscount: false,
    discountPercent: '',
    items: [{ name: 'Milk', categoryId: 'c1', amount: '4.50', shared: true, remark: '' }],
    ...overrides,
  };
}

const GROUP = 'g1';

describe('useExpenseDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isDraftMeaningful', () => {
    it('is false for null/undefined', () => {
      expect(isDraftMeaningful(null)).toBe(false);
      expect(isDraftMeaningful(undefined)).toBe(false);
    });

    it('is false for a blank form', () => {
      const blank = makeDraft({
        shopName: '',
        giftCardAmount: '',
        items: [{ name: '', categoryId: '', amount: '', shared: true, remark: '' }],
      });
      expect(isDraftMeaningful(blank)).toBe(false);
    });

    it('is true when a shop name is present', () => {
      const d = makeDraft({
        shopName: 'Coles',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      });
      expect(isDraftMeaningful(d)).toBe(true);
    });

    it('is true when an item has a name or amount', () => {
      expect(
        isDraftMeaningful(
          makeDraft({ shopName: '', items: [{ name: 'Eggs', categoryId: '', amount: '', shared: true }] }),
        ),
      ).toBe(true);
      expect(
        isDraftMeaningful(
          makeDraft({ shopName: '', items: [{ name: '', categoryId: '', amount: '9.99', shared: true }] }),
        ),
      ).toBe(true);
    });

    it('is true when a gift card amount is present', () => {
      const d = makeDraft({
        shopName: '',
        giftCardAmount: '20',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      });
      expect(isDraftMeaningful(d)).toBe(true);
    });

    it('is true when a discount is applied', () => {
      const d = makeDraft({
        shopName: '',
        applyDiscount: true,
        discountPercent: '2',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      });
      expect(isDraftMeaningful(d)).toBe(true);
    });

    it('is true when the discount checkbox is checked even with a blank percent', () => {
      const d = makeDraft({
        shopName: '',
        applyDiscount: true,
        discountPercent: '',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      });
      expect(isDraftMeaningful(d)).toBe(true);
    });

    it('is false for a leftover discount percent when the checkbox is unchecked', () => {
      const d = makeDraft({
        shopName: '',
        applyDiscount: false,
        discountPercent: '5',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      });
      expect(isDraftMeaningful(d)).toBe(false);
    });
  });

  describe('write / read / clear', () => {
    it('round-trips a meaningful draft', () => {
      const d = makeDraft();
      writeDraft(GROUP, d);
      expect(readDraft(GROUP)).toEqual(d);
    });

    it('returns null when nothing is stored', () => {
      expect(readDraft(GROUP)).toBeNull();
    });

    it('does not persist a blank draft, and clears any existing one', () => {
      writeDraft(GROUP, makeDraft());
      expect(readDraft(GROUP)).not.toBeNull();

      writeDraft(GROUP, makeDraft({
        shopName: '',
        giftCardAmount: '',
        items: [{ name: '', categoryId: '', amount: '', shared: true }],
      }));
      expect(readDraft(GROUP)).toBeNull();
    });

    it('clears a stored draft', () => {
      writeDraft(GROUP, makeDraft());
      clearDraft(GROUP);
      expect(readDraft(GROUP)).toBeNull();
    });

    it('keeps drafts separate per group', () => {
      writeDraft('g1', makeDraft({ shopName: 'Aldi' }));
      writeDraft('g2', makeDraft({ shopName: 'Costco' }));
      expect(readDraft('g1')?.shopName).toBe('Aldi');
      expect(readDraft('g2')?.shopName).toBe('Costco');
    });

    it('ignores an expired draft', () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(
        `expense_draft_${GROUP}`,
        JSON.stringify({ values: makeDraft(), savedAt: eightDaysAgo }),
      );
      expect(readDraft(GROUP)).toBeNull();
    });

    it('ignores corrupt JSON', () => {
      localStorage.setItem(`expense_draft_${GROUP}`, 'not json');
      expect(readDraft(GROUP)).toBeNull();
    });

    it('ignores malformed payloads', () => {
      localStorage.setItem(
        `expense_draft_${GROUP}`,
        JSON.stringify({ values: { shopName: 'x' }, savedAt: Date.now() }),
      );
      expect(readDraft(GROUP)).toBeNull();
    });

    it('reads a legacy draft saved before the discount fields existed', () => {
      // Pre-upgrade payload: no applyDiscount/discountPercent keys at all.
      const legacyValues = {
        date: '2026-07-11',
        shopName: 'Aldi',
        payerUid: 'u1',
        giftCardAmount: '',
        items: [{ name: 'Milk', categoryId: 'c1', amount: '4.50', shared: true, remark: '' }],
      };
      localStorage.setItem(
        `expense_draft_${GROUP}`,
        JSON.stringify({ values: legacyValues, savedAt: Date.now() }),
      );
      const draft = readDraft(GROUP);
      expect(draft?.shopName).toBe('Aldi');
      expect(draft?.applyDiscount).toBeUndefined();
      expect(draft?.discountPercent).toBeUndefined();
    });
  });

  describe('draft record', () => {
    it('round-trips movedFrom and the per-item flag', () => {
      const d = makeDraft({
        items: [{ name: 'Firewood', categoryId: 't-groc', amount: '18', shared: true, categoryUnconfirmed: true }],
      });
      writeDraft(GROUP, d, { movedFrom: 'Hartley House' });

      const record = readDraftRecord(GROUP);
      expect(record?.movedFrom).toBe('Hartley House');
      expect(record?.values.items[0].categoryUnconfirmed).toBe(true);
      expect(readDraft(GROUP)).toEqual(d);
    });

    it('has no movedFrom for an ordinary autosave', () => {
      writeDraft(GROUP, makeDraft());
      expect(readDraftRecord(GROUP)).toEqual({ values: makeDraft() });
    });

    it('still loads a draft saved before movedFrom existed', () => {
      localStorage.setItem(
        `expense_draft_${GROUP}`,
        JSON.stringify({ values: makeDraft(), savedAt: Date.now() }),
      );
      expect(readDraftRecord(GROUP)).toEqual({ values: makeDraft() });
      expect(readDraft(GROUP)).toEqual(makeDraft());
    });

    it('ignores a movedFrom that is not a string', () => {
      localStorage.setItem(
        `expense_draft_${GROUP}`,
        JSON.stringify({ values: makeDraft(), savedAt: Date.now(), movedFrom: 42 }),
      );
      expect(readDraftRecord(GROUP)?.movedFrom).toBeUndefined();
    });

    it('returns null for a blank or missing draft', () => {
      expect(readDraftRecord(GROUP)).toBeNull();
    });
  });
});
