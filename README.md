# SpendShare

Offline-first expense-splitting web app for households and groups. Members record expenses and income; the app computes monthly per-person spending, shared totals, and a minimized "who owes whom" settlement — synced through Firebase on the free Spark plan.

## Status

| Milestone | Status |
|-----------|--------|
| M0 — Project, TDD harness & CI | ✅ Done |
| M1 — Authentication | ✅ Done |
| M2 — Data model, Groups, Security Rules | ✅ Done |
| M3 — Invites | ⬜ Planned |
| M4 — Categories | ⬜ Planned |
| M5 — Expenses | ⬜ Planned |
| M6 — Income | ⬜ Planned |
| M7 — Summary & Settlement | ⬜ Planned |
| M8 — Offline / PWA / Deploy | ⬜ Planned |

## Supported features (M0–M2)

- **Authentication** — sign up / sign in with email + password or Google; email verification; sign out
- **Groups** — create a group with a name and currency (AUD/USD/EUR/GBP); group data is isolated per-member (Firestore security rules enforce access)
- **Group switcher** — switch between groups; selection persists across page reloads
- **Group settings** — rename a group or change its currency
- **Offline persistence** — Firestore IndexedDB cache keeps data readable when offline

## Tech stack

- Vite + React 18 + TypeScript
- Firebase v10 — Auth + Firestore (with `persistentLocalCache`)
- Zustand (UI state + localStorage persistence)
- react-hook-form + zod
- Tailwind CSS
- date-fns
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

### Against a real Firebase project

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** and **Google** sign-in under Authentication → Sign-in method
3. Create a **Firestore** database (production mode)
4. Copy `.env.example` to `.env.local` and fill in your project's values:

```bash
cp .env.example .env.local
```

```
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...
VITE_FB_MESSAGING_SENDER_ID=...
VITE_FB_APP_ID=...
```

```bash
npm run dev
```

## Available scripts

```bash
npm run dev           # Vite dev server (real Firebase project, needs .env.local)
npm run dev:emulator  # Vite dev server against local emulators
npm run emulators     # Start Firebase Auth + Firestore emulators
npm run build         # Production build → dist/
npm run typecheck     # TypeScript type check
npm run lint          # ESLint
npm test              # Vitest unit + component tests
npm run test:coverage # Test coverage report
```

## Deploying (M8)

Full deploy instructions will be added in Milestone 8. Deploy targets Firebase Hosting with the same project used for Auth and Firestore.
