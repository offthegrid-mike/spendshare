# M1 Auth — Functional Verification

- Branch: `milestone/M1-auth`
- Date: 2026-06-07
- Environment: macOS, Node v24.16.0, Java 26.0.1
- Firebase emulator project: `demo-spendshare` (Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080)
- Dev server: `npm run dev:emulator` (`VITE_USE_EMULATOR=true`) at http://localhost:5173
- Driver: standalone Playwright (chromium, headless) script
- Test account: `tester+<timestamp>@example.com` / `password123`

## Steps

### Step 1 — Sign in screen — PASS
Loaded http://localhost:5173. Asserted (waitFor visible):
- "Sign in" button (exact)
- "Create account" button
- "Continue with Google" button
- Email field (getByLabel)
- Password field (getByLabel)

Screenshot: `01-signin.png`

### Step 2 — Create account → authenticated shell — PASS
Filled Email + Password, clicked "Create account". Asserted:
- "Sign out" button visible (within 20s)
- Test email text visible on screen (within 10s)

The authenticated shell (Layout) renders the "SpendShare" app name, the user email,
the "Sign out" button, and placeholder home content ("No groups yet").

Verified out-of-band against the Auth emulator REST API: 1 account created with the
test email and provider `password`.

Screenshot: `02-signed-in.png`

### Step 3 — Sign out → return to Sign in — PASS
Clicked "Sign out". Asserted "Sign in" button (exact) visible again within 15s.

Screenshot: `03-signed-out.png`

## Console / page errors
None. No console errors and no uncaught page errors were observed during the run.

## Final status: PASS
All three steps passed with their assertions (not just screenshots).
