# SpendShare receipt-OCR proxy (Cloudflare Worker)

The NVIDIA API can't be called from the browser (no CORS) and we don't want the
API key in the client bundle. This Worker holds the key as a secret, forwards the
request to NVIDIA, and returns the response with CORS headers.

It's a passthrough: the SpendShare client POSTs the same chat/completions JSON it
would send to NVIDIA, and the Worker adds the `Authorization` header.

## Deploy (free tier, no credit card)

Prereqs: a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and
Node. From this `worker/` directory:

```bash
# 1. Log in (opens a browser)
npx wrangler login

# 2. Store your NVIDIA key as a secret (paste the nvapi-... value when prompted)
npx wrangler secret put NVIDIA_API_KEY

# 3. (Recommended) restrict who can use the proxy — comma-separated origins
npx wrangler secret put ALLOWED_ORIGINS
#   e.g. https://your-app.web.app,http://localhost:5173

# 4. Deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://spendshare-ocr.<your-subdomain>.workers.dev`.

Secrets (`NVIDIA_API_KEY`, `ALLOWED_ORIGINS`) are per-account state, not part of
the deployed code — they persist across deploys and are set once with the
commands above, not on every deploy.

## CI deploy on merge

`.github/workflows/deploy-worker.yml` redeploys this Worker automatically
whenever a push to `main` changes anything under `worker/`. One-time setup:

1. Create a Cloudflare API token at
   [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   using the **Edit Cloudflare Workers** template (scoped to this account).
2. Add it as a GitHub Actions repository secret named `CLOUDFLARE_API_TOKEN`
   (Settings → Secrets and variables → Actions).

That's it — the workflow runs `wrangler deploy` with that token. It does not
touch the `NVIDIA_API_KEY` / `ALLOWED_ORIGINS` secrets; those are set once
(step 2/3 above) and only need to be redone if you rotate the key.

## Wire it into the app

Set that URL as the app's OCR proxy endpoint:

- **Local dev:** `VITE_OCR_PROXY_URL=https://spendshare-ocr.<sub>.workers.dev` in `.env.local`, then restart `npm run dev`.
- **Deployed builds:** add a GitHub Actions repository secret `VITE_OCR_PROXY_URL` with the same URL (the deploy workflows already inject it).

The app's CSP (`firebase.json` → `connect-src`) already allows `https://*.workers.dev`.
If you put the Worker on a custom domain instead, add that origin to `connect-src`.

## Notes

- Free tier: 100,000 requests/day — far above receipt-scanning needs.
- The NVIDIA key lives only in the Worker secret; it is never shipped to the browser.
- To rotate the key: re-run `wrangler secret put NVIDIA_API_KEY` and redeploy.
