# SpendShare

Shared expense tracking for households and small groups. Members log what they spend, item by item, and mark each item as shared or personal. SpendShare works out everyone's share and the fewest payments needed to settle up each month.

Alongside it, a personal **Work tracker** records which days you worked from home, at the office or on leave, and totals the hours for the fixed rate working-from-home deduction. A **Home screen** after sign-in leads to both.

It works offline, installs as an app on desktop and mobile, and runs entirely on free tiers (Firebase Spark plan and Cloudflare Workers).

## Status

**Stable, in daily use.** The current release is **v2.1.0**. Every merge to `main` deploys to production automatically.

Releases are tagged in git. `v1.0.0` is the last release before the UI redesign, `v2.0.0` is the first release with it, and `v2.1.0` adds the Home screen and the Work tracker.

The original roadmap (milestones M0–M8: authentication, groups, invites, categories, expenses, income, settlement, offline and PWA) is complete. Later releases added expense search, receipt scanning, a yearly summary, a full UI redesign with dark mode, and the Work tracker.

## Features

### Home

- After sign-in, Home greets you and shows two tiles: **SpendShare** (the household's spending this month and your balance) and **Work** (today's status, weekdays not filled in, days to confirm, hours from home this income year, and the last five working days).
- SpendShare lives under `/spend` and the Work tracker under `/work`. Old links such as `/summary` still land on their `/spend` page.

### Work tracker

- Record each day as **Home**, **Office** or **Leave**. A Home day has a start, a finish and hours (7.6 by default): type the start in the morning and the finish fills in.
- When the finish time arrives, **Confirm finish** confirms it or changes it. An unconfirmed day still counts, and is listed for review one day at a time (there is no confirm-all).
- A day filled in after the day is marked **added later** and stays out of the claim until you include it. Every save, confirm, include and exclude is kept as a revision.
- Weekdays you usually work that have no record are shown as missing, from the date of your first saved day.
- **Year tab:** totals per month for each income year (1 July to 30 June), the claim at the fixed rate per hour (with cents dropped), and reviews of late and unconfirmed days.
- **Export:** two CSV files per income year, one row per day with the year's totals, and one row per revision.
- Set the rate for each income year (known rates are built in), your usual work days and your default hours. Work data is private to each user, not shared with a household.

### Expenses

- Record an expense with a shop, date, payer, and line items. Each item has a category, an amount, an optional quantity and remark, and a **shared** or **personal** flag.
- Quick-add strip: type an item, press Enter, and the next one is ready.
- Shop and item names autocomplete from the group's history, and a remembered item fills in its category.
- Record a gift card or a percentage discount (such as a card rebate) to show what was actually paid.
- An unsaved new expense is kept as a draft on the device, so a reload or a closed tab doesn't lose it.
- Browse expenses by month, grouped by day, with a detail pane. Edit or delete any expense.

### Receipt scanning (optional)

- **Scan receipt** reads a photo or PDF and fills in the shop, date, and line items.
- The image is never uploaded or stored. It is downscaled in the browser, sent once for OCR, and discarded.
- Disabled unless the OCR proxy is configured (see [Receipt scanning setup](#receipt-scanning-setup)).

### Search

- Search shop and item names across every month in the group, then jump straight to the matching expense.

### Summary and settlement

- **Month view:** settle-up comes first, with the minimum set of "who pays whom" payments, followed by each person's balance, spending, and shared totals.
- Mark a payment as paid (with undo). Paid amounts carry into the month's balances.
- **Year view:** spending and income for each month, and spending by category, for the whole year.

### Income

- Record one or more income entries per member per month, each with an optional description.

### Groups and members

- Create several groups, each with its own name and currency (AUD, USD, EUR, or GBP), and switch between them. The selected group is remembered across reloads.
- Invite members by email. Invitees see a pending-invite banner and can accept or decline, and a pending invite can be revoked. An invitee must also be on the allowlist (see Accounts).
- The group owner can add members who don't have an account (for example, a child or a housemate who won't sign in) and remove members.
- Default categories are created with each group. Add, rename, or delete your own.
- Firestore security rules keep each group's data visible only to its members.

### Accounts

- Sign in with email and password or with Google.
- Email verification on sign-up, and password reset by email.
- Only allowlisted people can use the app. Anyone else who signs in sees a "can't use SpendShare" screen, and the Firestore rules refuse all their reads and writes. An email-and-password account must verify its email first.

### Offline, install, and appearance

- All data stays readable offline through Firestore's IndexedDB cache, and changes made offline sync when the connection returns.
- A service worker caches the app shell, so the app opens without a network connection.
- Installable as a PWA from the browser.
- Light, dark, or system theme.
- The More screen shows the build's commit and date, so you can confirm which deploy is live.

## How splitting works

1. Each item belongs to the person who paid for the expense.
2. **Personal** items count toward the payer's own spending only.
3. **Shared** items are added up for the month and split evenly across all group members.
4. A member's balance is what they paid toward shared items minus their even share. Positive means they're owed money, negative means they owe.
5. Debts are matched largest-first to produce the fewest payments. Payments already marked as paid are applied before the next round.

Gift cards and discounts appear against the receipt total for reference. They don't change the split, which always uses the item amounts.

All money is stored as integer cents.

## Tech stack

| Area | Tools |
|------|-------|
| App | Vite, React 19, TypeScript, React Router 7 |
| Data | Firebase 12: Auth, and Firestore with `persistentLocalCache` |
| State and forms | Zustand (UI state, persisted to localStorage), react-hook-form, zod |
| UI | Tailwind CSS with semantic design tokens, lucide-react icons, Geist font, Recharts, react-day-picker, date-fns |
| Offline | vite-plugin-pwa and Workbox |
| Receipt OCR | pdf.js (PDF to image) and a Cloudflare Worker proxy to an NVIDIA-hosted vision model |
| Testing | Vitest and Testing Library, `@firebase/rules-unit-testing`, Playwright |
| Hosting and CI | Firebase Hosting and GitHub Actions |

## Project structure

```
src/
  features/      Screens, one folder per area (home, work, auth, expenses, summary, income, groups, invites, search, …)
  components/    App shell and shared UI (layout, dock, top bar, sheets, ui/ primitives)
  hooks/         Firestore data hooks (useMonthExpenses, useSettlements, useYearOverview, useWorkDays, …)
  lib/           Pure logic: settlement, money, discounts, search, receipt OCR, theme, routes; lib/work/ for the Work tracker
  stores/        Zustand UI store
  types/         Firestore document models and zod schemas
tests/           Vitest tests, Firestore rules tests, Playwright offline spec
worker/          Cloudflare Worker that proxies receipt OCR requests
scripts/         Emulator seed data and app icon generation
docs/            Receipt OCR research, security reviews, design specs and plans
firestore.rules  Security rules (deployed from main by CI)
```

## Running locally

### Prerequisites

- Node.js 20 or newer (CI uses 22). Node 18 fails to start Vitest.
- Java, for the Firebase emulators (`java -version` to check)
- Firebase CLI, for deploying by hand: `npm install -g firebase-tools`

### With the Firebase emulators (recommended)

No Firebase project or API keys needed.

```bash
npm install

# Terminal 1: start the Auth and Firestore emulators
npm run emulators

# Terminal 2 (optional): fill the emulators with a sample two-person household
npm run seed:emulator

# Terminal 2: start the dev server, which connects to the emulators
npm run dev:emulator
```

Open http://localhost:5173. After seeding, sign in as `mike@example.com` with password `password123`. Without seed data, sign up with any email address. The emulator sends no real emails.

The seed script wipes the emulators' Auth and Firestore data before writing.

### With a real Firebase project

Copy `.env.example` to `.env.local`, fill in the values, then run `npm run dev`.

| Variable | Purpose |
|----------|---------|
| `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_FB_STORAGE_BUCKET`, `VITE_FB_SENDER_ID`, `VITE_FB_APP_ID` | Firebase web app config |
| `VITE_OCR_PROXY_URL` | Optional. URL of the receipt OCR Worker. Leave blank to hide receipt scanning. |
| `VITE_USE_EMULATOR` | Set by `npm run dev:emulator`. Leave blank. |

Then add yourself to the allowlist, or the app will turn you away. In the Firebase console, open Firestore Database and create a collection named `allowlist` with one document per person. The document ID is the person's email in lower case, and the document needs no fields. Do the same for everyone you share a group with. The emulator seed script adds its sample users for you.

### Receipt scanning setup

Receipt scanning needs the Cloudflare Worker in `worker/`, which holds the NVIDIA API key so it never reaches the browser. Both services have free tiers that need no credit card.

1. Deploy the Worker and set its secrets by following [worker/README.md](worker/README.md).
2. Put the Worker's URL in `VITE_OCR_PROXY_URL`: in `.env.local` for local development, and as a GitHub Actions secret for deployed builds.

[docs/RECEIPT_OCR.md](docs/RECEIPT_OCR.md) explains the design: why a proxy is needed, which model is used, and why no images are stored.

## Scripts

```bash
npm run dev             # Dev server against the real Firebase project (needs .env.local)
npm run dev:emulator    # Dev server against the local emulators
npm run emulators       # Start the Auth and Firestore emulators
npm run seed:emulator   # Wipe the emulators and load sample data
npm run build           # Type-check and build for production into dist/
npm run preview         # Serve the production build locally
npm run typecheck       # TypeScript check
npm run lint            # ESLint, which fails on any warning
npm test                # Vitest unit and component tests
npm run test:watch      # Vitest in watch mode
npm run test:coverage   # Tests with a coverage report
npm run test:rules      # Firestore security rules tests (emulators must be running)
npm run icons           # Regenerate the PWA icons from the design tokens
npm run deploy          # Build and deploy to Firebase Hosting
npm run deploy:rules    # Deploy Firestore rules and indexes only
```

## Testing

Before opening a PR, run:

```bash
npm run typecheck && npm run lint && npm test
```

CI runs the same checks, plus a production build, on every pull request.

Security rules tests run against the Firestore emulator. Start it with `npm run emulators`, then run `npm run test:rules`.

The Playwright spec checks the production PWA build (service worker, manifest, offline load). It expects a preview server on port 5174:

```bash
npm run build && npm run preview -- --port 5174
```

Then, in a second terminal:

```bash
npx playwright test
```

## Deployment

Deployment is automated through GitHub Actions:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Pull requests and pushes to `main` | Type-check, lint, test, build |
| `firebase-hosting-pull-request.yml` | Pull requests | Deploy a preview channel and comment its URL on the PR |
| `firebase-hosting-merge.yml` | Push to `main` | Deploy Firestore rules and indexes, then the app to the live channel |
| `deploy-worker.yml` | Push to `main` that changes `worker/` | Redeploy the OCR proxy Worker |

The workflows read the Firebase config, the Firebase service account, `VITE_OCR_PROXY_URL`, and `CLOUDFLARE_API_TOKEN` from repository secrets.

To deploy by hand:

```bash
firebase login
firebase use spendshare-e5236
npm run deploy          # app
npm run deploy:rules    # Firestore rules and indexes
```

## Contributing

- Branch from `main` and open a pull request. Nothing is committed to `main` directly.
- PRs are squash-merged.
- Write a failing test first for any behavior change.
- Data hooks in `src/hooks/` must not call `setState` synchronously inside an effect. The lint rule `react-hooks/set-state-in-effect` fails the build.

[CLAUDE.md](CLAUDE.md) has the full workflow and code conventions.

## Further reading

- [docs/RECEIPT_OCR.md](docs/RECEIPT_OCR.md): receipt OCR design and free-tier research
- [docs/SECURITY_ASSESSMENT.md](docs/SECURITY_ASSESSMENT.md): security assessment
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): the original M0–M8 plan
