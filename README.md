# SpendShare

Offline-first expense-splitting web app for households and groups. Members record expenses and income; the app computes monthly per-person spending, shared totals, and a minimized "who owes whom" settlement — synced through Firebase on the free Spark plan.

**Live app:** https://spendshare-e5236.web.app

## Status

| Milestone | Status |
|-----------|--------|
| M0 — Project, TDD harness & CI | ✅ Done |
| M1 — Authentication | ✅ Done |
| M2 — Data model, Groups, Security Rules | ✅ Done |
| M3 — Invites | ✅ Done |
| M4 — Categories | ✅ Done |
| M5 — Expenses | ✅ Done |
| M6 — Income | ✅ Done |
| M7 — Summary & Settlement | ✅ Done |
| M8 — Offline / PWA / Deploy | ✅ Done |

## Supported features

- **Authentication** — sign up / sign in with email + password or Google; email verification; sign out
- **Groups** — create a group with a name and currency (AUD/USD/EUR/GBP); group data is isolated per-member via Firestore security rules
- **Group switcher** — switch between multiple groups; selection persists across reloads
- **Group settings** — rename a group or change its currency
- **Invites** — invite members by email; pending invite banner; accept or decline
- **Categories** — seeded default categories; add, rename, delete custom categories per group
- **Expenses** — create, edit, and delete expense transactions with line items and payer assignment
- **Income** — record monthly income per member
- **Summary & Settlement** — monthly per-person spending, shared totals, and a minimized "who owes whom" settlement; mark individual payments as paid (with undo)
- **Offline support** — Firestore IndexedDB cache keeps all data readable offline; PWA service worker caches the app shell so the app loads without a network connection
- **Installable** — install SpendShare as a PWA on desktop or mobile from the browser address bar

## Tech stack

- Vite + React 19 + TypeScript
- Firebase v12 — Auth + Firestore (with `persistentLocalCache`)
- Zustand (UI state + localStorage persistence)
- react-hook-form + zod
- Tailwind CSS
- date-fns
- vite-plugin-pwa + Workbox
- Vitest + Playwright (testing + functional verification)

## Running locally

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Java (required by Firebase emulators): `java -version`

### Against the Firebase emulators (recommended for development)

No cloud account or API keys needed.

```bash
npm install

# Terminal 1 — start Auth + Firestore emulators
npm run emulators

# Terminal 2 — start Vite dev server (auto-connects to emulators)
npm run dev:emulator
```

Open [http://localhost:5173](http://localhost:5173). Sign up with any email/password — the emulator accepts any address with no real emails sent.

### Against the live Firebase project

Copy `.env.example` to `.env.local` and fill in your Firebase project values, then:

```bash
npm run dev
```

## Available scripts

```bash
npm run dev             # Vite dev server (real Firebase, needs .env.local)
npm run dev:emulator    # Vite dev server against local emulators
npm run emulators       # Start Firebase Auth + Firestore emulators
npm run build           # Production build → dist/
npm run preview         # Preview production build locally
npm run typecheck       # TypeScript type check
npm run lint            # ESLint
npm test                # Vitest unit + component tests
npm run test:coverage   # Test coverage report
npm run deploy          # Build + deploy to Firebase Hosting
npm run deploy:rules    # Deploy Firestore rules + indexes only
```

## Deploying

```bash
# One-time setup
firebase login
firebase use spendshare-e5236

# Deploy app
npm run deploy

# Deploy Firestore rules/indexes only
npm run deploy:rules
```

The app is hosted at **https://spendshare-e5236.web.app** and also at **https://spendshare-e5236.firebaseapp.com**.
