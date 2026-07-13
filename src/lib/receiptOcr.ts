import { z } from 'zod';
import { normalizeNameKey } from './textNormalize';

// ---------------------------------------------------------------------------
// Receipt OCR via NVIDIA's free hosted vision API.
//
// A picked receipt photo is downscaled in the browser, sent as a base64 image
// to a vision-language model (OpenAI-compatible chat-completions), and the model
// returns structured JSON we map onto the expense form. The image is never
// uploaded or stored — it exists only for the duration of this one request, so
// the app stays on Firebase's free plan.
//
// The request goes through a small proxy (a Cloudflare Worker — see `worker/`)
// rather than calling NVIDIA directly, for two reasons: (1) NVIDIA's endpoint
// sends no CORS headers, so browsers can't read a direct response; (2) the API
// key stays server-side in the Worker instead of being bundled into client JS.
// The client only knows the proxy URL (`VITE_OCR_PROXY_URL`), never the key.
// ---------------------------------------------------------------------------

// Vision-language model on the NVIDIA API catalog. Kept as a single const so
// swapping models (if catalog availability changes) is a one-line edit.
const OCR_MODEL = 'meta/llama-3.2-90b-vision-instruct';

function buildPrompt(categoryNames: string[]): string {
  const base =
    'You are a receipt parser. Extract the receipt in this image as strict JSON ' +
    'matching exactly this shape: ' +
    '{"shopName": string, "date": "YYYY-MM-DD", "items": [{"name": string, "amount": number, "quantity": number, "category": string}], "total": number}. ' +
    'Numbers are in the receipt currency (no symbols). ' +
    '"amount" is the PER-ITEM (unit) price and "quantity" is how many units were bought. ' +
    'If a line shows a total for multiple units (e.g. "2 @ $2.75" = 5.50), set amount to the unit ' +
    'price (2.75) and quantity to 2. For a single unit, quantity is 1 and amount is that line price. ' +
    'Use the purchase date in YYYY-MM-DD format. ' +
    'Include only real purchased line items (skip subtotals, tax, and totals as items). ';
  const categoryRule =
    categoryNames.length > 0
      ? 'For each item set "category" to the single best fit chosen EXACTLY from this list: ' +
        `[${categoryNames.join(', ')}]. If none fit, omit "category" for that item. ` +
        'Do not invent categories outside the list. '
      : 'Omit the "category" field. ';
  return (
    base +
    categoryRule +
    'If a field is unreadable, omit it. Return ONLY the JSON object, with no commentary or code fences.'
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export const receiptSchema = z.object({
  shopName: z.string().optional(),
  date: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
        quantity: z.number().optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  total: z.number().optional(),
});

export type ParsedReceipt = z.infer<typeof receiptSchema>;

export type ReceiptOcrErrorCode =
  | 'not-configured'
  | 'network'
  | 'rate-limit'
  | 'bad-response'
  | 'parse';

export class ReceiptOcrError extends Error {
  code: ReceiptOcrErrorCode;
  userMessage: string;
  constructor(code: ReceiptOcrErrorCode, userMessage: string) {
    super(`${code}: ${userMessage}`);
    this.name = 'ReceiptOcrError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

// A single line item shaped exactly like the expense form's `items` entries.
export interface FormItemPatch {
  name: string;
  categoryId: string;
  amount: string; // per-item (unit) price
  quantity: string;
  shared: boolean;
  remark: string;
}

export interface ReceiptFormPatch {
  date?: string;
  shopName?: string;
  items?: FormItemPatch[];
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested — no browser APIs)
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from a model response. VLMs frequently wrap output in
 * ```json fences or add prose, so we slice from the first `{` to the last `}`
 * and parse that. Throws a `parse` ReceiptOcrError on failure.
 */
export function extractJsonBlock(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new ReceiptOcrError('parse', 'Could not read the receipt. Enter the details manually.');
  }
  const slice = content.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    throw new ReceiptOcrError('parse', 'Could not read the receipt. Enter the details manually.');
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Map a parsed receipt onto a partial expense-form patch. Every field is
 * defensive: a key is included only when the value is usable, so the caller
 * safely keeps the current form value for anything OCR omitted or got wrong.
 * Amounts become decimal strings (`"12.34"`) — the form stores strings and
 * runs `toCents` at submit. The AI-suggested `category` name is resolved to a
 * real `categoryId` against `cats` (case-insensitive); no match → '' (No
 * category), which the user can still change per row.
 */
export function receiptToFormPatch(
  parsed: ParsedReceipt,
  current: { date: string; shopName: string },
  cats: { id: string; name: string }[] = [],
): ReceiptFormPatch {
  const patch: ReceiptFormPatch = {};

  // Build a name-key → id lookup for resolving AI-suggested categories.
  const catByKey = new Map(cats.map((c) => [normalizeNameKey(c.name), c.id]));

  // Date — only accept a valid ISO YYYY-MM-DD; otherwise keep the current date.
  if (parsed.date && ISO_DATE.test(parsed.date) && !Number.isNaN(new Date(parsed.date).getTime())) {
    patch.date = parsed.date;
  }

  // Shop name — only when non-empty; otherwise keep whatever is there.
  // Capitalize the first letter of each word for consistency (the model may
  // return it lowercased off a logo), preserving any existing capitals/acronyms.
  const shop = parsed.shopName?.trim();
  if (shop) {
    patch.shopName = shop.replace(/(^|\s)(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
  }

  // Items — map to form rows, dropping empty names and coercing bad amounts to
  // an empty string (surfaces the normal required-amount validation). Omit the
  // key entirely when nothing usable was found so the caller leaves items alone.
  const items = (parsed.items ?? [])
    .map((it): FormItemPatch => {
      const qty = Number.isFinite(it.quantity) && (it.quantity as number) >= 1
        ? String(Math.floor(it.quantity as number))
        : '1';
      return {
        name: it.name.trim(),
        categoryId: it.category ? (catByKey.get(normalizeNameKey(it.category)) ?? '') : '',
        amount: Number.isFinite(it.amount) && it.amount >= 0 ? it.amount.toFixed(2) : '',
        quantity: qty,
        shared: true,
        remark: '',
      };
    })
    .filter((it) => it.name.length > 0);
  if (items.length > 0) {
    patch.items = items;
  }

  // Reference `current` so callers/readers see it is the fallback source.
  void current;

  return patch;
}

// ---------------------------------------------------------------------------
// IO helpers (browser / network)
// ---------------------------------------------------------------------------

// NVIDIA's hosted vision endpoint only accepts images passed inline as base64
// when the base64 string is under ~180 KB; larger images require the separate
// NVCF assets API. We compress the receipt to stay under this limit.
export const INLINE_IMAGE_MAX_B64 = 180_000;

/** Length of the base64 payload of a `data:...;base64,<b64>` URL. */
export function base64Length(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl.length : dataUrl.length - comma - 1;
}

/** Whether a data URL is small enough to send inline to the NVIDIA endpoint. */
export function withinInlineLimit(dataUrl: string): boolean {
  return base64Length(dataUrl) < INLINE_IMAGE_MAX_B64;
}

// Progressively smaller dimension/quality steps, tried in order until the JPEG
// fits the inline base64 limit. The last step is the smallest we'll send.
const ENCODE_STEPS: { dim: number; quality: number }[] = [
  { dim: 1024, quality: 0.8 },
  { dim: 1024, quality: 0.6 },
  { dim: 900, quality: 0.6 },
  { dim: 800, quality: 0.55 },
  { dim: 700, quality: 0.5 },
  { dim: 600, quality: 0.45 },
];

/** Whether a picked file is a PDF (by MIME type or extension). */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Draw an image/canvas source into a JPEG data URL, retrying at progressively
 * smaller dimensions/qualities until it fits the inline base64 limit. Returns
 * the smallest attempt even if still over (the API may still accept it).
 */
function encodeSourceUnderLimit(source: HTMLImageElement | HTMLCanvasElement): string {
  const srcW = source.width;
  const srcH = source.height;
  const encodeAt = (maxDim: number, quality: number): string => {
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  };
  let out = '';
  for (const step of ENCODE_STEPS) {
    out = encodeAt(step.dim, step.quality);
    if (withinInlineLimit(out)) break;
  }
  return out;
}

/**
 * Downscale an image file to a JPEG data URL (`data:image/jpeg;base64,…`) small
 * enough to send inline to the NVIDIA endpoint (< ~180 KB base64). Browser-only.
 *
 * The source is loaded via a `data:` URL (FileReader), not `URL.createObjectURL`,
 * because the app's CSP `img-src` allows `data:` but not `blob:` — a blob URL
 * would be blocked and the image would fail to load.
 */
export function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new ReceiptOcrError('bad-response', 'Could not read the image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(encodeSourceUnderLimit(img));
        } catch {
          reject(new ReceiptOcrError('bad-response', 'Could not process the image.'));
        }
      };
      img.onerror = () =>
        reject(new ReceiptOcrError('bad-response', 'Could not read the image file.'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Render the first page of a PDF to a JPEG data URL that fits the inline limit.
 * pdf.js is imported lazily so it only loads when a PDF is actually picked
 * (keeps it out of the main bundle). Browser-only (canvas + worker).
 */
export async function pdfFirstPageToDataUrl(file: File): Promise<string> {
  let doc: { getPage: (n: number) => Promise<unknown>; destroy?: () => void } | undefined;
  try {
    const pdfjs = await import('pdfjs-dist');
    // Same-origin worker asset; set once.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const data = new Uint8Array(await file.arrayBuffer());
    doc = await pdfjs.getDocument({ data }).promise;
    // Render page 1 at 2x for legible text, then compress to fit the limit.
    const page = (await doc.getPage(1)) as {
      getViewport: (o: { scale: number }) => { width: number; height: number };
      render: (o: unknown) => { promise: Promise<void> };
    };
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ReceiptOcrError('bad-response', 'Could not process the PDF.');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return encodeSourceUnderLimit(canvas);
  } catch (err) {
    if (err instanceof ReceiptOcrError) throw err;
    throw new ReceiptOcrError('bad-response', 'Could not read the PDF.');
  } finally {
    doc?.destroy?.();
  }
}

/**
 * Send a base64 image data URL to the OCR proxy (which forwards to the NVIDIA
 * vision model) and return the validated, parsed receipt. Takes a data URL (not
 * a File) so it is testable without a canvas.
 */
export async function requestReceiptOcr(
  dataUrl: string,
  categoryNames: string[] = [],
): Promise<ParsedReceipt> {
  const proxyUrl = import.meta.env.VITE_OCR_PROXY_URL;
  if (!proxyUrl) {
    throw new ReceiptOcrError('not-configured', 'Receipt scanning is not configured.');
  }

  let res: Response;
  try {
    // The proxy adds the NVIDIA Authorization header; the browser never sees the key.
    res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        temperature: 0.1,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPrompt(categoryNames) },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new ReceiptOcrError('network', 'Network error while scanning. Check your connection.');
  }

  if (res.status === 429) {
    throw new ReceiptOcrError('rate-limit', 'Too many scans right now — wait a moment and retry.');
  }
  if (!res.ok) {
    throw new ReceiptOcrError('bad-response', 'The receipt service returned an error.');
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ReceiptOcrError('bad-response', 'The receipt service returned an unreadable response.');
  }

  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== 'string') {
    throw new ReceiptOcrError('bad-response', 'The receipt service returned an unexpected response.');
  }

  try {
    return receiptSchema.parse(extractJsonBlock(content));
  } catch (err) {
    if (err instanceof ReceiptOcrError) throw err;
    throw new ReceiptOcrError('parse', 'Could not read the receipt. Enter the details manually.');
  }
}

/** Downscale/render + OCR a picked receipt file (image or PDF). `categoryNames`
 *  constrains the AI's category suggestions to the group's existing categories. */
export async function scanReceipt(
  file: File,
  categoryNames: string[] = [],
): Promise<ParsedReceipt> {
  const dataUrl = isPdf(file) ? await pdfFirstPageToDataUrl(file) : await downscaleToDataUrl(file);
  return requestReceiptOcr(dataUrl, categoryNames);
}
