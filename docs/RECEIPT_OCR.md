# Receipt OCR & Free-Tier Investigation

Investigation into two questions, plus the feature built from the findings:

1. **NVIDIA's free API** — can it OCR receipts, and how?
2. **Firebase's free tier** — how many images can it store?

_Researched July 2026._

---

## 1. NVIDIA free API for receipt OCR

### Access & limits (free tier)

- Sign up for the free **NVIDIA Developer Program** at [build.nvidia.com](https://build.nvidia.com) and generate an API key (prefixed `nvapi-`).
- Free tier: **1,000 inference credits** on signup (up to **5,000** on request), a **40 requests/minute** rate limit, **no credit card** required.
- Credits are consumed per request regardless of model size.

### Two ways to read a receipt

| Approach | Endpoint | Output | Fit for receipts |
| --- | --- | --- | --- |
| **Vision-Language Model (VLM)** ✅ _used here_ | `POST https://integrate.api.nvidia.com/v1/chat/completions` (OpenAI-compatible) | Whatever you prompt for — we ask for **structured JSON** | Best: one call → `{shopName, date, items[], total}`, no text parsing |
| **Dedicated OCR NIM** (`nemoretriever-ocr` / `nemotron-ocr`) | `/v1/infer` | Raw text + bounding boxes + confidence | Lower-level: needs heuristic/regex parsing to reach fields |

The VLM route is what SpendShare implements: the OpenAI-compatible body carries a `text` part (the
extraction prompt) and an `image_url` part with a `data:image/jpeg;base64,…` data URL, and the model
returns JSON we map straight onto the expense form. The model id lives in one constant (`OCR_MODEL`
in `src/lib/receiptOcr.ts`, currently `meta/llama-3.2-90b-vision-instruct`) so it's a one-line swap
if catalog availability changes.

The browser does **not** call NVIDIA directly — see the CORS/key section below.

### Request shape (what the browser sends to the proxy → NVIDIA)

```jsonc
POST <VITE_OCR_PROXY_URL>              // browser → Worker (no key here)
// Worker adds:  Authorization: Bearer nvapi-...  and forwards to NVIDIA
{
  "model": "meta/llama-3.2-90b-vision-instruct",
  "temperature": 0.1,
  "max_tokens": 1024,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "<extraction prompt asking for strict JSON>" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,<...>" } }
    ]
  }]
}
```

### CORS + key exposure — why there's a proxy

Two problems rule out calling NVIDIA straight from the browser:

1. **CORS.** NVIDIA's endpoint returns no `Access-Control-Allow-Origin` header, so a browser `fetch`
   gets the response (HTTP 200) but is blocked from reading it. Only a server can add that header.
2. **Key exposure.** Any `VITE_`-prefixed value is bundled into client JS and is public, so the key
   can't safely live in the browser.

Both are solved by a small **Cloudflare Worker** proxy (`worker/`, free tier — no credit card). The
Worker holds the `NVIDIA_API_KEY` as a secret, forwards the chat/completions body to NVIDIA, and
returns the response with CORS headers. The client only knows the Worker URL (`VITE_OCR_PROXY_URL`),
never the key. This keeps SpendShare on the free Firebase Spark plan (no Firebase Cloud
Functions / Blaze needed).

---

## 2. Firebase free tier — how many images can it store?

**The headline:** as of **February 3, 2026, the Spark (free) plan no longer includes Cloud
Storage at all.** Storing images now requires the pay-as-you-go **Blaze** plan (credit card
required).

| Plan | Cloud Storage | No-cost quota | Beyond quota |
| --- | --- | --- | --- |
| **Spark (free)** | ❌ Removed Feb 3, 2026 | — | — |
| **Blaze (pay-as-you-go)** | ✅ | **1 GiB** storage + 10 GB/month egress | $0.026/GB storage, $0.12/GB egress |

**How many receipt images fit in the 1 GiB Blaze free quota** (compressed JPEG):

| Avg image size | Approx. receipts in 1 GiB |
| --- | --- |
| ~200 KB | ~5,000 |
| ~500 KB | ~2,000 |
| ~1 MB | ~1,000 |

**Free alternatives** (if image storage is ever wanted without Blaze): Cloudinary free (~25 monthly
credits, splittable across ~10 GB storage/bandwidth/transforms), Supabase Storage (5 GB free),
ImgBB, etc.

### SpendShare's choice: store nothing

To keep the app fully on the **free Spark plan**, receipt scanning **does not upload or store any
image**. The picked photo is downscaled and OCR'd in the browser, the extracted data prefills the
expense form, and the image is discarded — it exists only for the single OCR request. The storage
question is therefore moot for this feature.

---

## 3. What was implemented

A **"Scan receipt"** button on the expense editor (`ExpenseEditor.tsx`), backed by
`src/lib/receiptOcr.ts`:

- **Accepts images and PDFs.** `downscaleToDataUrl` canvas-downscales an image; `pdfFirstPageToDataUrl`
  renders a PDF's first page (pdf.js, lazy-loaded only when a PDF is picked) — both compressed to fit
  the inline limit. `scanReceipt` routes by file type (`isPdf`).
- `requestReceiptOcr` — POST to the OCR proxy (`VITE_OCR_PROXY_URL`), with typed errors
  (`not-configured`, `network`, `rate-limit`, `bad-response`, `parse`) surfaced as friendly messages.
- `extractJsonBlock` + `receiptSchema` (zod) — tolerate fenced/prose-wrapped output and validate.
- `receiptToFormPatch` — defensively map the parsed receipt onto the form: valid ISO date only,
  shop name title-cased, line items as `{name, categoryId, amount, quantity, shared}` where **amount
  is the per-item (unit) price** and **quantity** is the count (a `2 @ $2.75` line → amount `2.75`,
  quantity `2`). Anything unusable is omitted so the user's current values are preserved.

**Amount is the unit price, with a quantity beside it.** The line total = unit × quantity. On save,
the stored `ItemDoc.amount` remains the **line total** (so splitting/summaries/settlements are
unchanged), plus `unitAmount` and `quantity` are stored for round-trip editing. Items saved before
this change (no `quantity`) are treated as quantity 1.

**Categories are assigned by the AI, constrained to your existing categories.** The group's active
category names are passed into the prompt; the model picks the best fit per item, and
`receiptToFormPatch` resolves that name back to a real `categoryId` (case-insensitive match, reusing
`normalizeNameKey`). If nothing matches — or the model omits a category — the item lands as **No
category** (`''`) and the user can set it per row. The AI never invents new categories.

In the editor, scanned scalars use `setValue(...)` and line items use `useFieldArray`'s
`replace(...)`; the existing autosave-draft and submit validation (`items.min(1)`) are unaffected.

### Setup

1. Get a free key at [build.nvidia.com](https://build.nvidia.com) (`nvapi-…`).
2. **Deploy the proxy Worker** (`worker/README.md`): `wrangler secret put NVIDIA_API_KEY`, then
   `wrangler deploy`. This stores the key server-side and prints the Worker URL
   (`https://spendshare-ocr.<sub>.workers.dev`).
3. **Local dev:** set `VITE_OCR_PROXY_URL=<worker url>` in `.env.local` and restart `npm run dev`
   (Vite reads env only at startup). If unset, the button shows a friendly "not configured" message
   and the rest of the form is unaffected.
4. **Deployed builds (preview + production):** Vite inlines env vars at **build time**, so add a
   GitHub Actions **repository secret** named `VITE_OCR_PROXY_URL` (Settings → Secrets and variables
   → Actions). The deploy workflows already inject it. A local `.env` alone does **not** reach the
   deployed site.
5. The production CSP (`firebase.json` → `connect-src`) already allows `https://*.workers.dev`.

**Image size:** NVIDIA's hosted endpoint only accepts images passed inline as base64 under ~180 KB;
`downscaleToDataUrl` compresses each receipt (progressively smaller dimension/quality) to stay under
that limit, so no separate asset-upload step is needed.

## Sources

- NVIDIA NIM free API — rate limits, keys, pricing: <https://decodethefuture.org/en/nvidia-nim-api-explained/>
- `nemoretriever-ocr` model: <https://build.nvidia.com/nvidia/nemoretriever-ocr-v1>
- NVIDIA OpenAI-compatible chat-completions reference: <https://docs.api.nvidia.com/nim/reference/create_chat_completion_v1_chat_completions_post>
- Firebase Cloud Storage Spark→Blaze change (Feb 2026): <https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024>
- Firebase pricing plans: <https://firebase.google.com/pricing>
