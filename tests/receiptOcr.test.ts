import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractJsonBlock,
  receiptToFormPatch,
  requestReceiptOcr,
  receiptSchema,
  ReceiptOcrError,
  base64Length,
  withinInlineLimit,
  INLINE_IMAGE_MAX_B64,
  isPdf,
} from '../src/lib/receiptOcr';

const CURRENT = { date: '2026-07-01', shopName: 'Existing Shop' };

describe('extractJsonBlock', () => {
  it('parses a raw JSON object', () => {
    expect(extractJsonBlock('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json code fences', () => {
    const content = '```json\n{"shopName":"Coles"}\n```';
    expect(extractJsonBlock(content)).toEqual({ shopName: 'Coles' });
  });

  it('tolerates prose before and after the JSON', () => {
    const content = 'Here is the receipt: {"total": 12.5}. Hope that helps!';
    expect(extractJsonBlock(content)).toEqual({ total: 12.5 });
  });

  it('throws a parse error on non-JSON garbage', () => {
    expect(() => extractJsonBlock('no json here')).toThrowError(ReceiptOcrError);
    try {
      extractJsonBlock('no json here');
    } catch (e) {
      expect((e as ReceiptOcrError).code).toBe('parse');
    }
  });

  it('throws a parse error on a malformed brace block', () => {
    try {
      extractJsonBlock('{ not: valid, json }');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ReceiptOcrError).code).toBe('parse');
    }
  });
});

describe('receiptSchema', () => {
  it('accepts a full object', () => {
    const r = receiptSchema.parse({
      shopName: 'X',
      date: '2026-01-02',
      items: [{ name: 'A', amount: 1.5 }],
      total: 1.5,
    });
    expect(r.items?.[0].amount).toBe(1.5);
  });

  it('accepts an object with all fields omitted', () => {
    expect(receiptSchema.parse({})).toEqual({});
  });

  it('rejects a string amount', () => {
    expect(() => receiptSchema.parse({ items: [{ name: 'A', amount: '1.5' }] })).toThrow();
  });

  it('rejects items that are not an array', () => {
    expect(() => receiptSchema.parse({ items: 'nope' })).toThrow();
  });
});

describe('receiptToFormPatch', () => {
  it('maps a number amount to a 2-decimal string with form defaults', () => {
    const patch = receiptToFormPatch({ items: [{ name: 'Milk', amount: 4.5 }] }, CURRENT);
    expect(patch.items).toEqual([
      { name: 'Milk', categoryId: '', amount: '4.50', quantity: '1', shared: true, remark: '' },
    ]);
  });

  it('maps unit price and quantity for multi-buy lines, defaulting quantity to 1', () => {
    const patch = receiptToFormPatch(
      { items: [{ name: 'Sunbites', amount: 2.75, quantity: 2 }, { name: 'Milk', amount: 4.5 }] },
      CURRENT,
    );
    expect(patch.items?.[0]).toMatchObject({ amount: '2.75', quantity: '2' });
    expect(patch.items?.[1]).toMatchObject({ amount: '4.50', quantity: '1' });
  });

  it('floors and floors-to-1 bad quantities', () => {
    const patch = receiptToFormPatch(
      {
        items: [
          { name: 'A', amount: 1, quantity: 3.9 },
          { name: 'B', amount: 1, quantity: 0 },
          { name: 'C', amount: 1, quantity: -2 },
        ],
      },
      CURRENT,
    );
    expect(patch.items?.map((i) => i.quantity)).toEqual(['3', '1', '1']);
  });

  it('omits the items key when there are no usable items', () => {
    expect(receiptToFormPatch({ items: [] }, CURRENT)).not.toHaveProperty('items');
    expect(receiptToFormPatch({}, CURRENT)).not.toHaveProperty('items');
  });

  it('filters out items with empty names', () => {
    const patch = receiptToFormPatch(
      { items: [{ name: '   ', amount: 1 }, { name: 'Eggs', amount: 2 }] },
      CURRENT,
    );
    expect(patch.items).toHaveLength(1);
    expect(patch.items?.[0].name).toBe('Eggs');
  });

  it('coerces negative or non-finite amounts to an empty string', () => {
    const patch = receiptToFormPatch(
      { items: [{ name: 'A', amount: -3 }, { name: 'B', amount: Number.NaN }] },
      CURRENT,
    );
    expect(patch.items?.[0].amount).toBe('');
    expect(patch.items?.[1].amount).toBe('');
  });

  it('passes a valid ISO date through and omits invalid ones', () => {
    expect(receiptToFormPatch({ date: '2026-07-11' }, CURRENT).date).toBe('2026-07-11');
    expect(receiptToFormPatch({ date: '2026-13-40' }, CURRENT)).not.toHaveProperty('date');
    expect(receiptToFormPatch({ date: '07/11/2026' }, CURRENT)).not.toHaveProperty('date');
    expect(receiptToFormPatch({}, CURRENT)).not.toHaveProperty('date');
  });

  it('trims and capitalizes a present shopName, omits a blank one', () => {
    expect(receiptToFormPatch({ shopName: '  coles  ' }, CURRENT).shopName).toBe('Coles');
    expect(receiptToFormPatch({ shopName: 'woolworths metro' }, CURRENT).shopName).toBe(
      'Woolworths Metro',
    );
    // Existing capitals / acronyms are preserved.
    expect(receiptToFormPatch({ shopName: 'IGA' }, CURRENT).shopName).toBe('IGA');
    expect(receiptToFormPatch({ shopName: '   ' }, CURRENT)).not.toHaveProperty('shopName');
    expect(receiptToFormPatch({}, CURRENT)).not.toHaveProperty('shopName');
  });

  describe('AI category → categoryId', () => {
    const CATS = [
      { id: 'c1', name: 'Groceries' },
      { id: 'c2', name: 'Household' },
    ];

    it('resolves an exact category name to its id', () => {
      const patch = receiptToFormPatch(
        { items: [{ name: 'Milk', amount: 1, category: 'Groceries' }] },
        CURRENT,
        CATS,
      );
      expect(patch.items?.[0].categoryId).toBe('c1');
    });

    it('resolves case-insensitively and ignoring surrounding whitespace', () => {
      const patch = receiptToFormPatch(
        { items: [{ name: 'Soap', amount: 1, category: '  household  ' }] },
        CURRENT,
        CATS,
      );
      expect(patch.items?.[0].categoryId).toBe('c2');
    });

    it('falls back to No category for an unknown category name', () => {
      const patch = receiptToFormPatch(
        { items: [{ name: 'Petrol', amount: 1, category: 'Fuel' }] },
        CURRENT,
        CATS,
      );
      expect(patch.items?.[0].categoryId).toBe('');
    });

    it('uses No category when the item has no category or no cats are provided', () => {
      expect(
        receiptToFormPatch({ items: [{ name: 'X', amount: 1 }] }, CURRENT, CATS).items?.[0]
          .categoryId,
      ).toBe('');
      expect(
        receiptToFormPatch({ items: [{ name: 'X', amount: 1, category: 'Groceries' }] }, CURRENT)
          .items?.[0].categoryId,
      ).toBe('');
    });
  });
});

describe('inline image size limit', () => {
  it('base64Length counts only the payload after the comma', () => {
    expect(base64Length('data:image/jpeg;base64,AAAA')).toBe(4);
    expect(base64Length('AAAA')).toBe(4); // no comma → whole string
  });

  it('withinInlineLimit is true under the limit and false at/over it', () => {
    const under = 'data:image/jpeg;base64,' + 'A'.repeat(INLINE_IMAGE_MAX_B64 - 1);
    const over = 'data:image/jpeg;base64,' + 'A'.repeat(INLINE_IMAGE_MAX_B64 + 1);
    expect(withinInlineLimit(under)).toBe(true);
    expect(withinInlineLimit(over)).toBe(false);
  });
});

describe('isPdf', () => {
  const mk = (name: string, type: string) => ({ name, type }) as File;
  it('detects PDFs by MIME type', () => {
    expect(isPdf(mk('receipt', 'application/pdf'))).toBe(true);
  });
  it('detects PDFs by .pdf extension (case-insensitive) when type is missing', () => {
    expect(isPdf(mk('receipt.PDF', ''))).toBe(true);
    expect(isPdf(mk('scan.pdf', 'application/octet-stream'))).toBe(true);
  });
  it('treats images as non-PDF', () => {
    expect(isPdf(mk('photo.jpg', 'image/jpeg'))).toBe(false);
    expect(isPdf(mk('photo.png', 'image/png'))).toBe(false);
  });
});

describe('requestReceiptOcr', () => {
  const DATA_URL = 'data:image/jpeg;base64,AAAA';

  function jsonResponse(content: string, ok = true, status = 200): Response {
    return {
      ok,
      status,
      json: async () => ({ choices: [{ message: { content } }] }),
    } as unknown as Response;
  }

  beforeEach(() => {
    vi.stubEnv('VITE_OCR_PROXY_URL', 'https://ocr.example.workers.dev');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns a validated receipt on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse('{"shopName":"X","items":[{"name":"A","amount":1.5}]}'),
    );
    const r = await requestReceiptOcr(DATA_URL);
    expect(r.shopName).toBe('X');
    expect(r.items?.[0].amount).toBe(1.5);
  });

  it('throws not-configured and never calls fetch when the proxy URL is missing', async () => {
    vi.stubEnv('VITE_OCR_PROXY_URL', '');
    await expect(requestReceiptOcr(DATA_URL)).rejects.toMatchObject({ code: 'not-configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to the configured proxy URL, not NVIDIA directly', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse('{"shopName":"X"}'),
    );
    await requestReceiptOcr(DATA_URL);
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe('https://ocr.example.workers.dev');
    // The browser must not send an Authorization header — the proxy adds the key.
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('maps HTTP 429 to a rate-limit error', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse('', false, 429),
    );
    await expect(requestReceiptOcr(DATA_URL)).rejects.toMatchObject({ code: 'rate-limit' });
  });

  it('maps other non-ok responses to bad-response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse('', false, 500));
    await expect(requestReceiptOcr(DATA_URL)).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('maps a thrown fetch to a network error', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    await expect(requestReceiptOcr(DATA_URL)).rejects.toMatchObject({ code: 'network' });
  });

  it('maps unparseable content to a parse error', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse('I could not read this receipt'),
    );
    await expect(requestReceiptOcr(DATA_URL)).rejects.toMatchObject({ code: 'parse' });
  });
});
