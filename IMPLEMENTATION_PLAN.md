# SpendShare v1 — Implementation Plan & Progress Tracker

> **Standalone, resumable plan.** Run it **one milestone at a time**; you can stop after any milestone and resume later with no loss of state. Completed work is checked off below.

**Goal:** Offline-first web app where members of a household/group record expenses and income, and the app computes monthly per-person spending, shared spending, and a minimized "who owes whom" settlement — synced through Firebase on the free Spark plan.

**Architecture:** Vite + React + TypeScript SPA (no backend). Firebase Auth for identity, Firestore for storage with IndexedDB offline persistence. Group privacy enforced by Firestore security rules (membership stored as a `members` map on the group doc). Financial math in pure, unit-tested modules. Future iOS/Android via Capacitor wrapping the same client.

**Tech Stack:** Vite, React 18, TypeScript, react-router-dom v6, Firebase v10 SDK (`initializeFirestore` + `persistentLocalCache`), Zustand, react-hook-form + zod, Tailwind CSS, date-fns, vite-plugin-pwa, Vitest, Playwright (functional verification via Firebase emulators).

---

## 📊 Progress Dashboard

| Milestone | Status | Branch | Merged |
|-----------|--------|--------|--------|
| **M0** — Project, TDD harness & CI | ✅ **DONE** | `milestone/M0-setup` | PR #1 |
| **M1** — Authentication | ✅ **DONE** | `milestone/M1-auth` | PR #2 |
| **M2** — Data model, Groups, Security Rules | ✅ **DONE** | `milestone/M2-groups` | PR #4 |
| **M3** — Invites | ⬜ TODO | `milestone/M3-invites` | — |
| **M4** — Categories | ⬜ TODO | `milestone/M4-categories` | — |
| **M5** — Expenses | ⬜ TODO | `milestone/M5-expenses` | — |
| **M6** — Income | ⬜ TODO | `milestone/M6-income` | — |
| **M7** — Summary & Settlement | ⬜ TODO | `milestone/M7-summary` | — |
| **M8** — Offline/PWA & Deploy | ⬜ TODO | `milestone/M8-pwa-deploy` | — |

**👉 Resume point: start M3.**

---

## ▶️ How to run this plan (one milestone per session)

Each milestone is self-contained and ends with working, merged software. To run the next milestone (in a fresh Claude Code session or yourself):

1. Tell Claude: **"Continue the SpendShare plan — do M2"** (or whichever is next). Claude reads this file + `IMPLEMENTATION_PLAN.md`'s dashboard to find the resume point.
2. Claude runs that milestone end-to-end (see workflow below), then **stops** so you can review/pause.
3. After it merges, this file's dashboard is updated (check off the milestone) and you can stop.

### Per-milestone workflow (the conventions we agreed on)
- Work on a branch `milestone/M<n>-<slug>` off `main`. **Never commit feature work directly to `main`.**
- **TDD with split roles:** a *test-writer* subagent writes failing tests; a separate *implementer* subagent makes them pass without editing the tests; then *spec* + *code-quality* review.
- **Functional verification** uses the **Firebase Local Emulator Suite** (no cloud project needed) driven by Playwright/webwright; screenshot evidence saved under `final_runs/run_M<n>-*/`.
- **Merge gate (Definition of Done):** all of —
  - `npm run typecheck && npm run lint && npm test && npm run build` pass (full regression, not just new tests)
  - functional acceptance check passes (UI milestones) with evidence
  - CI is green on the PR
  - then merge via PR (squash) and delete the branch.
- **Branch protection** is NOT enabled on GitHub (private repo needs Pro). The gate is enforced **by process** (PR + green CI before merge). Default branch is **`main`**.

### Useful commands
```bash
# Gates (run from repo root)
npm run typecheck && npm run lint && npm test && npm run build

# Local dev against emulators (two terminals)
npm run emulators        # Auth :9099, Firestore :8080 (demo-spendshare)
npm run dev:emulator     # Vite with VITE_USE_EMULATOR=true
```

### ⚠️ What needs YOU (out-of-band)
- **M8 deploy** (and live Google sign-in): a real Firebase project — create it in the console, enable Email/Password + Google auth and Firestore, paste the 6 `VITE_FB_*` values into `.env.local`. Everything before M8 is verified against emulators and needs no cloud account.

---

## Context & key product decisions (confirmed with user)
- **Stack:** Vite + React SPA (PWA), mobile later via Capacitor.
- **Split model:** shared items split **equally** among all current group members.
- **Income:** tracking only — does **not** affect splitting.
- **Group model:** a user creates a household/group and invites others by email; visibility is per-group.
- **Expense shape:** transaction with **multiple line items**; total auto-summed.
- **Payer:** **one payer per transaction**.
- **Currency:** **single currency per group** (a setting); no conversion.
- **Categories:** **user-managed list per group**, seeded with defaults.

### Cross-cutting conventions (apply everywhere)
- **Money stored as integer cents** (`number`); format at the edge. Helpers in `src/lib/money.ts`.
- **Month keys are `'YYYY-MM'` strings**; used for all monthly queries.
- **Every `items`/`expenses` doc carries denormalized `groupId` and `month`** (and `items` also `payerUid`) so the summary `collectionGroup('items')` query and the security rules work.
- **Data access via Firestore `onSnapshot` wrapped in custom hooks** — no React Query.
- **Frequent commits** (one per red step, one per green step).

### Free-tier risks (documented, not blocking v1)
- Any group member can technically rewrite the `members` map (rules allow member updates). OK for trusted households in v1.
- Accept-invite is gated on `request.auth.token.email_verified` (Google is verified; email/password must verify first).
- `collectionGroup('items')` monthly reads consume the 50K reads/day quota; offline cache serves repeat reads free.

---

## Execution & Orchestration Model
- `main` is the protected-by-policy integration branch; always green.
- Each milestone on its own branch; merge only when Definition of Done is met (above).
- Subagent roles per milestone: **test-writer** (failing tests only) → **implementer** (green, never edits tests) → **verifier/reviewer** (regression + functional check).
- Pure-logic tasks (money, month, settlement) are unit-TDD'd. UI tasks are functionally verified via webwright against emulators.

---

## File Structure
```
spendshare/
  index.html  vite.config.ts  tsconfig*.json  tailwind.config.js  eslint.config.js
  .env.example  firebase.json  firestore.rules  firestore.indexes.json  .firebaserc
  .github/workflows/ci.yml
  src/
    main.tsx  App.tsx  index.css
    lib/        firebase.ts  money.ts  settlement.ts  month.ts  converters.ts  seedCategories.ts
    types/      models.ts
    stores/     uiStore.ts
    hooks/      useAuth.ts useGroups.ts useGroup.ts useCategories.ts useMonthExpenses.ts
                useMonthItems.ts useIncome.ts useSettlements.ts useInvites.ts
    features/   auth/ groups/ invites/ categories/ expenses/ income/ summary/
    components/ ui/ Layout.tsx MonthPicker.tsx GroupSwitcher.tsx Money.tsx
  tests/        money.test.ts month.test.ts settlement.test.ts (+ component tests)
  final_runs/   run_M<n>-*/   (functional verification evidence)
```

---

# ✅ Milestone 0 — Project, TDD harness & CI  (DONE — PR #1)

- [x] **0.1** Initialize Vite React-TS project (`npm create vite@latest . -- --template react-ts`).
- [x] **0.2** Install core deps (firebase, react-router-dom, zustand, react-hook-form, zod, @hookform/resolvers, date-fns; dev: vitest, testing-library, jsdom, vite-plugin-pwa).
- [x] **0.3** Configure Tailwind v3 (`content` globs; `@tailwind` directives in `src/index.css`).
- [x] **0.4** Configure Vitest (`src/test/setup.ts`, `vitest/config` in `vite.config.ts`, smoke test).
- [x] **0.5** Firebase init + env (`.env.example`, `.env.local`, `src/lib/firebase.ts` with `initializeFirestore` + `persistentLocalCache`).
- [x] **0.6** Lint + typecheck + coverage scripts (`typecheck`, `lint`, `test`, `test:coverage`, `build`).
- [x] **0.7** Install Playwright + chromium for functional verification.
- [x] **0.8** GitHub Actions CI (`.github/workflows/ci.yml`: typecheck → lint → test → build); PR + merge.

**Notes:** ESLint flat config (`eslint.config.js`); `vitest/config` import (Vitest 4); Tailwind pinned v3. Branch protection not enabled (private repo / Pro) → policy gate.

---

# ✅ Milestone 1 — Authentication  (DONE — PR #2)

- [x] **Emulator harness** (added on M1 branch): `.firebaserc` (`demo-spendshare`), `firebase.json` (auth:9099, firestore:8080), `firestore.rules` locked placeholder, `firestore.indexes.json`, emulator wiring in `firebase.ts` guarded by `VITE_USE_EMULATOR`, `emulators` + `dev:emulator` scripts.
- [x] **1.1** `useAuth()` hook — `onAuthStateChanged` → `{ user, loading }`.
- [x] **1.2** `SignIn` screen — email/password sign-in, account creation + `sendEmailVerification`, Google popup, validation + error display.
- [x] **1.3** Auth gate (`App.tsx`: loading → SignIn → Layout) + `BrowserRouter` in `main.tsx`; `Layout.tsx` with app name, user email, sign-out.
- [x] Unit/component tests (10/10), spec+quality review (APPROVE), functional verification via emulator (`final_runs/run_M1-auth/`).

**Deferred polish (non-blocking, fold into a later pass):**
1. `Layout.tsx` opens a second `useAuth()` subscription — lift `user` from `App` via prop/context.
2. Add `autoComplete="email"` / `autoComplete="current-password"` to `SignIn` inputs.
3. `SignIn` shows no confirmation after account creation / `sendEmailVerification`.

---

# ⬜ Milestone 2 — Data model, Groups, Security Rules

> Branch `milestone/M2-groups`. Functional acceptance (webwright): create a group, see it in the switcher, edit currency; with a second account confirm its data is NOT readable (permission-denied). Unit tests cover `money`/`month`.

### Task 2.1: Document types + zod schemas
**Files:** Create `src/types/models.ts`.

- [ ] Define interfaces + zod schemas (money = integer cents; `month` = `'YYYY-MM'`):

```ts
import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type Uid = string;
export type Role = 'owner' | 'member';

export interface UserDoc {
  uid: Uid; email: string; displayName: string; photoURL?: string;
  memberOf: string[]; createdAt: Timestamp;
}
export interface GroupMember { role: Role; displayName: string; email: string; joinedAt: Timestamp; }
export interface GroupDoc {
  id: string; name: string; currency: string; ownerUid: Uid;
  members: Record<Uid, GroupMember>; memberUids: Uid[]; createdAt: Timestamp;
}
export interface InviteDoc {
  email: string; invitedByUid: Uid; invitedByName: string; groupName: string;
  status: 'pending' | 'accepted' | 'revoked'; createdAt: Timestamp;
}
export interface CategoryDoc { id: string; name: string; order: number; archived: boolean; }
export interface ExpenseDoc {
  id: string; groupId: string; date: Timestamp; month: string; shopName: string;
  payerUid: Uid; total: number; itemCount: number; createdByUid: Uid;
  createdAt: Timestamp; updatedAt: Timestamp;
}
export interface ItemDoc {
  id: string; groupId: string; expenseId: string; month: string;
  name: string; categoryId: string; category: string; amount: number; shared: boolean;
  payerUid: Uid; // denormalized from the expense (for collectionGroup summary)
}
export interface IncomeDoc { uid: Uid; month: string; amount: number; }
export interface SettlementDoc {
  id: string; month: string; fromUid: Uid; toUid: Uid; amount: number;
  paid: boolean; paidAt?: Timestamp; markedByUid?: Uid;
}

export const itemSchema = z.object({
  groupId: z.string(), expenseId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string().min(1), categoryId: z.string(), category: z.string(),
  amount: z.number().int().nonnegative(), shared: z.boolean(), payerUid: z.string(),
});
```

### Task 2.2: Money + month helpers (TDD)
**Files:** `src/lib/money.ts`, `src/lib/month.ts`; tests `tests/money.test.ts`, `tests/month.test.ts`.

- [ ] **Write failing tests** `tests/money.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toCents, formatMoney, distributeEvenly } from '../src/lib/money';

describe('money', () => {
  it('parses dollars to integer cents', () => {
    expect(toCents('1.5')).toBe(150);
    expect(toCents('2.91')).toBe(291);
    expect(toCents('100')).toBe(10000);
  });
  it('formats cents with currency', () => {
    expect(formatMoney(12841, 'AUD')).toBe('A$128.41');
  });
  it('distributes a total into equal integer shares summing exactly to the total', () => {
    const shares = distributeEvenly(10000, ['a', 'b', 'c']);
    expect(shares.a + shares.b + shares.c).toBe(10000);
    expect(Object.values(shares).every((c) => c === 3334 || c === 3333)).toBe(true);
  });
});
```
`tests/month.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { monthKey } from '../src/lib/month';
describe('month', () => {
  it('formats a date as YYYY-MM', () => {
    expect(monthKey(new Date('2026-06-07T00:00:00'))).toBe('2026-06');
  });
});
```
- [ ] **Run** `npm test` → FAIL (modules missing).
- [ ] **Implement `src/lib/money.ts`:**
```ts
export function toCents(input: string | number): number {
  const n = typeof input === 'number' ? input : parseFloat(input);
  return Math.round(n * 100);
}
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}
export function distributeEvenly(totalCents: number, ids: string[]): Record<string, number> {
  const n = ids.length;
  const out: Record<string, number> = {};
  if (n === 0) return out;
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  for (const id of [...ids].sort()) { out[id] = base + (remainder-- > 0 ? 1 : 0); }
  return out;
}
```
- [ ] **Implement `src/lib/month.ts`:**
```ts
import { format } from 'date-fns';
export function monthKey(d: Date): string { return format(d, 'yyyy-MM'); }
```
- [ ] **Run** `npm test` → PASS. Commit.

### Task 2.3: Firestore security rules + indexes
**Files:** `firestore.rules`, `firestore.indexes.json` (replace M1 placeholders).

- [ ] **`firestore.rules`:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function myEmail() { return request.auth.token.email.lower(); }
    function isMember(groupId) {
      return signedIn()
        && exists(/databases/$(database)/documents/groups/$(groupId))
        && (request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members);
    }
    function isOwner(groupId) {
      return signedIn()
        && get(/databases/$(database)/documents/groups/$(groupId)).data.ownerUid == request.auth.uid;
    }

    match /users/{uid} {
      allow read: if signedIn();
      allow create, update, delete: if signedIn() && request.auth.uid == uid;
    }

    match /groups/{groupId} {
      allow read: if signedIn() && request.auth.uid in resource.data.members;
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.auth.uid in request.resource.data.members
        && request.resource.data.memberUids.hasOnly([request.auth.uid]);
      allow update: if isMember(groupId)
        || ( signedIn()
             && request.auth.token.email_verified == true
             && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members', 'memberUids'])
             && !(request.auth.uid in resource.data.members)
             && request.auth.uid in request.resource.data.members
             && exists(/databases/$(database)/documents/groups/$(groupId)/invites/$(myEmail()))
             && get(/databases/$(database)/documents/groups/$(groupId)/invites/$(myEmail())).data.status == 'pending' );
      allow delete: if isOwner(groupId);

      match /invites/{inviteId} {
        allow create: if isMember(groupId);
        allow read, write: if isMember(groupId)
          || (signedIn() && resource != null && resource.data.email == myEmail());
      }
      match /categories/{categoryId}    { allow read, write: if isMember(groupId); }
      match /expenses/{expenseId} {
        allow read, write: if isMember(groupId);
        match /items/{itemId}           { allow read, write: if isMember(groupId); }
      }
      match /income/{incomeId}          { allow read, write: if isMember(groupId); }
      match /settlements/{settlementId} { allow read, write: if isMember(groupId); }
    }

    match /{path=**}/items/{itemId} {
      allow read: if isMember(resource.data.groupId);
    }
  }
}
```
- [ ] **`firestore.indexes.json`:**
```json
{
  "indexes": [
    { "collectionGroup": "items", "queryScope": "COLLECTION_GROUP",
      "fields": [ { "fieldPath": "groupId", "order": "ASCENDING" }, { "fieldPath": "month", "order": "ASCENDING" } ] },
    { "collectionGroup": "invites", "queryScope": "COLLECTION_GROUP",
      "fields": [ { "fieldPath": "email", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" } ] }
  ],
  "fieldOverrides": []
}
```
- [ ] **Verify rules against the emulator** with unit tests using `@firebase/rules-unit-testing` (recommended) OR document a manual two-account check. Member can read/write own group; non-member is denied. Commit.

### Task 2.4: Typed collection refs + user doc upsert
**Files:** `src/lib/converters.ts`; modify `src/hooks/useAuth.ts`.

- [ ] **`converters.ts`** — typed collection ref helpers: `usersCol`, `groupsCol`, `expensesCol(gid)`, `itemsCol(gid,eid)`, `incomeCol(gid)`, `categoriesCol(gid)`, `invitesCol(gid)`, `settlementsCol(gid)`.
- [ ] In `useAuth`, on sign-in upsert `/users/{uid}` `{ uid, email: lower, displayName, photoURL, createdAt: serverTimestamp() }` via `setDoc(..., { merge: true })`; initialize `memberOf: []` only on first create.
- [ ] Verify: signing in creates `/users/{uid}` in the emulator UI. Commit.

### Task 2.5: Create group + switcher + UI store + settings
**Files:** `src/stores/uiStore.ts`, `src/hooks/useGroups.ts`, `src/hooks/useGroup.ts`, `src/features/groups/CreateGroup.tsx`, `src/features/groups/GroupSettings.tsx`, `src/components/GroupSwitcher.tsx`.

- [ ] **`uiStore.ts`** (Zustand): `{ selectedGroupId, selectedMonth, setGroup, setMonth }`; default month = `monthKey(new Date())`; persist `selectedGroupId` to `localStorage`.
- [ ] **`useGroups.ts`** — `onSnapshot(query(groupsCol, where('memberUids','array-contains', uid)))`.
- [ ] **`useGroup.ts`** — subscribe to `selectedGroupId` doc.
- [ ] **`CreateGroup.tsx`** — form (name, currency dropdown AUD/USD/EUR/GBP). On submit `addDoc(groupsCol, ...)` with creator as sole member `{ [uid]: { role:'owner', ... } }`, `memberUids:[uid]`, `ownerUid:uid`; then set `selectedGroupId` and seed default categories (uses M4 helper — define `seedDefaultCategories` here or in M4 and import).
- [ ] **`GroupSwitcher.tsx`** — dropdown bound to `uiStore`; "＋ New group". Mount in `Layout`.
- [ ] **`GroupSettings.tsx`** — edit name + currency (route `/group/settings`).
- [ ] **App gate:** no groups → `CreateGroup`; else render app with selected group.
- [ ] Verify (webwright): create group, switch, reload persists; second account denied. Commit.

---

# ⬜ Milestone 3 — Invites

> Branch `milestone/M3-invites`. Functional acceptance (two accounts): A invites B's email; B signs in, sees pending invite, accepts, can now read A's group.

### Task 3.1: Send invite
**Files:** `src/features/invites/SendInvite.tsx`, `src/hooks/useInvites.ts`.
- [ ] `SendInvite.tsx` — email input (lowercased). `setDoc(doc(invitesCol(gid), email), { email, invitedByUid, invitedByName, groupName, status:'pending', createdAt: serverTimestamp() })`. Note: "Invite the exact email they'll sign in with." List outgoing invites with status; allow revoke (`status:'revoked'`).
- [ ] Verify invite doc appears. Commit.

### Task 3.2: Incoming invites + accept/decline
**Files:** modify `useInvites.ts`; `src/features/invites/PendingInvites.tsx`.
- [ ] Incoming query: `onSnapshot(query(collectionGroup(db,'invites'), where('email','==', myEmail), where('status','==','pending')))`.
- [ ] `PendingInvites.tsx` — Accept runs a `writeBatch`: update group (`members.${uid}` + `memberUids` arrayUnion), invite `status:'accepted'`, user `memberOf` arrayUnion. Decline → `status:'declined'`. Derive group ref via invite snapshot `ref.parent.parent`.
- [ ] Surface as banner/badge in `Layout` when count > 0.
- [ ] Verify end-to-end (two accounts; B's email must be verified per the accept rule). Commit.

---

# ⬜ Milestone 4 — Categories

> Branch `milestone/M4-categories`. Functional acceptance: new group shows seeded categories; add/rename/archive reflected in a picker.

### Task 4.1: Seed defaults + manage categories
**Files:** `src/hooks/useCategories.ts`, `src/features/categories/CategoryManager.tsx`, `src/lib/seedCategories.ts`.
- [ ] `seedCategories.ts` — `seedDefaultCategories(gid)` batch-writes: Groceries, Dining, Transport, Utilities, Household, Entertainment, Health, Other (`{ name, order, archived:false }`). Called at group creation.
- [ ] `useCategories.ts` — `onSnapshot` ordered by `order`; filter `archived` for pickers, show all in manager.
- [ ] `CategoryManager.tsx` (route `/categories`) — add / rename / archive-unarchive (no hard delete).
- [ ] Verify (webwright). Commit.

---

# ⬜ Milestone 5 — Expenses

> Branch `milestone/M5-expenses`. Functional acceptance: add a multi-item transaction (mixed shared/personal, chosen payer), confirm auto-summed total, edit and delete from the monthly list.

### Task 5.1: Expense editor (transaction + line items)
**Files:** `src/features/expenses/ExpenseEditor.tsx`, `src/hooks/useMonthExpenses.ts`.
- [ ] Editor: react-hook-form `useFieldArray`. Fields: `date` (default today), `shopName`, `payerUid` (member select), N items `{ name, categoryId (select), amount (text→cents), shared (checkbox) }`. Live total = sum of item cents.
- [ ] Save with `writeBatch`: expense doc `{ groupId, date: Timestamp.fromDate(date), month: monthKey(date), shopName, payerUid, total, itemCount, createdByUid, createdAt, updatedAt: serverTimestamp() }`; each item in `itemsCol(gid, expenseId)` `{ groupId, expenseId, month, name, categoryId, category, amount, shared, payerUid }`. Commit atomically.
- [ ] Verify denormalized `groupId`/`month`/`payerUid`; total matches. Commit.

### Task 5.2: Monthly list + edit/delete + MonthPicker
**Files:** `src/features/expenses/ExpenseList.tsx`, `src/components/MonthPicker.tsx`; modify `useMonthExpenses.ts`.
- [ ] `useMonthExpenses.ts` — `onSnapshot(query(expensesCol(gid), where('month','==', selectedMonth), orderBy('date','desc')))`.
- [ ] `MonthPicker.tsx` — prev/next month bound to `uiStore.selectedMonth`. Mount in `Layout`.
- [ ] `ExpenseList.tsx` (route `/`) — list (date, shop, payer, total, item count), expand items; edit re-batches (update expense, upsert items, delete removed); delete batch-deletes expense + items.
- [ ] Verify (webwright). Commit.

---

# ⬜ Milestone 6 — Income

> Branch `milestone/M6-income`. Functional acceptance: enter income per member for a month, switch months and back, values persist.

### Task 6.1: Monthly income per member
**Files:** `src/features/income/IncomeEditor.tsx`, `src/hooks/useIncome.ts`.
- [ ] `useIncome.ts` — `onSnapshot(query(incomeCol(gid), where('month','==', selectedMonth)))`.
- [ ] `IncomeEditor.tsx` (route `/income`) — one row per member, amount input (cents). Save id `${uid}_${month}`: `setDoc(doc(incomeCol(gid), id), { uid, month, amount }, { merge: true })`.
- [ ] Verify (webwright). Commit.

---

# ⬜ Milestone 7 — Summary & Settlement

> Branch `milestone/M7-summary`. 7.1 is pure-logic TDD. Functional acceptance for 7.2: enter known expenses, open Summary, confirm totals/shares/balances match a hand calc, mark a payment paid → moves to "Settled".

### Task 7.1: Settlement algorithm (TDD, pure)
**Files:** `src/lib/settlement.ts`; test `tests/settlement.test.ts`.
- [ ] **Write failing tests** `tests/settlement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeSummary } from '../src/lib/settlement';

const members = ['alice', 'bob', 'carol'];
const items = [
  { amount: 9000, shared: true,  payerUid: 'alice' },
  { amount: 3000, shared: true,  payerUid: 'bob' },
  { amount: 1500, shared: false, payerUid: 'carol' },
];

describe('computeSummary', () => {
  it('computes per-person paid totals', () => {
    expect(computeSummary(members, items, []).paidTotal).toEqual({ alice: 9000, bob: 3000, carol: 1500 });
  });
  it('computes shared total and equal share', () => {
    const s = computeSummary(members, items, []);
    expect(s.sharedTotal).toBe(12000);
    expect(s.shareOf.alice + s.shareOf.bob + s.shareOf.carol).toBe(12000);
    expect(s.shareOf.alice).toBe(4000);
  });
  it('computes balances that sum to zero', () => {
    const s = computeSummary(members, items, []);
    expect(Object.values(s.balance).reduce((a, b) => a + b, 0)).toBe(0);
    expect(s.balance.alice).toBe(5000);
    expect(s.balance.carol).toBe(-4000);
  });
  it('produces minimized settlement transactions', () => {
    const s = computeSummary(members, items, []);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'carol', toUid: 'alice', amount: 4000 },
      { fromUid: 'bob',   toUid: 'alice', amount: 1000 },
    ]));
    expect(s.transactions).toHaveLength(2);
  });
  it('removes already-paid debts from outstanding transactions', () => {
    const paid = [{ fromUid: 'carol', toUid: 'alice', amount: 4000, paid: true } as any];
    expect(computeSummary(members, items, paid).transactions).toEqual([{ fromUid: 'bob', toUid: 'alice', amount: 1000 }]);
  });
});
```
- [ ] **Run** → FAIL.
- [ ] **Implement `src/lib/settlement.ts`** (uses `distributeEvenly`):
```ts
import { distributeEvenly } from './money';

export interface SummaryItem { amount: number; shared: boolean; payerUid: string; }
export interface PaidSettlement { fromUid: string; toUid: string; amount: number; paid: boolean; }
export interface Txn { fromUid: string; toUid: string; amount: number; }
export interface Summary {
  paidTotal: Record<string, number>; sharedTotal: number;
  shareOf: Record<string, number>; balance: Record<string, number>; transactions: Txn[];
}

export function computeSummary(members: string[], items: SummaryItem[], settlements: PaidSettlement[]): Summary {
  const paidTotal: Record<string, number> = {}; const paidShared: Record<string, number> = {};
  for (const m of members) { paidTotal[m] = 0; paidShared[m] = 0; }
  let sharedTotal = 0;
  for (const it of items) {
    if (paidTotal[it.payerUid] === undefined) { paidTotal[it.payerUid] = 0; paidShared[it.payerUid] = 0; }
    paidTotal[it.payerUid] += it.amount;
    if (it.shared) { sharedTotal += it.amount; paidShared[it.payerUid] += it.amount; }
  }
  const shareOf = distributeEvenly(sharedTotal, members);
  const balance: Record<string, number> = {};
  for (const m of members) balance[m] = (paidShared[m] ?? 0) - (shareOf[m] ?? 0);
  for (const s of settlements) {
    if (!s.paid) continue;
    balance[s.fromUid] = (balance[s.fromUid] ?? 0) + s.amount;
    balance[s.toUid] = (balance[s.toUid] ?? 0) - s.amount;
  }
  const debtors = members.filter((m) => balance[m] < 0).map((m) => ({ uid: m, amt: -balance[m] }));
  const creditors = members.filter((m) => balance[m] > 0).map((m) => ({ uid: m, amt: balance[m] }));
  debtors.sort((a, b) => b.amt - a.amt); creditors.sort((a, b) => b.amt - a.amt);
  const transactions: Txn[] = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) transactions.push({ fromUid: debtors[i].uid, toUid: creditors[j].uid, amount: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++; if (creditors[j].amt === 0) j++;
  }
  return { paidTotal, sharedTotal, shareOf, balance, transactions };
}
```
- [ ] **Run** → PASS. Commit.

### Task 7.2: Summary page + mark-paid
**Files:** `src/features/summary/Summary.tsx`, `src/hooks/useMonthItems.ts`, `src/hooks/useSettlements.ts`.
- [ ] `useMonthItems.ts` — `onSnapshot(query(collectionGroup(db,'items'), where('groupId','==', gid), where('month','==', selectedMonth)))`. (Items carry denormalized `payerUid` from M5.)
- [ ] `useSettlements.ts` — `onSnapshot(query(settlementsCol(gid), where('month','==', selectedMonth)))`.
- [ ] `Summary.tsx` (route `/summary`) — `computeSummary(memberUids, items, settlements)`. Render per-person paid total + equal share + income (display-only); group shared total + grand total; "Settle up" list of `transactions` with **Mark paid** → `setDoc(doc(settlementsCol(gid), `${month}_${fromUid}_${toUid}`), { month, fromUid, toUid, amount, paid:true, paidAt: serverTimestamp(), markedByUid })`. Paid ones in a "Settled" list with **Undo**. Money via `formatMoney(cents, group.currency)`.
- [ ] Verify (webwright) vs hand calc; mark-paid behavior. Commit.

---

# ⬜ Milestone 8 — Offline / PWA / Deploy

> Branch `milestone/M8-pwa-deploy`. Functional acceptance: PWA installs; offline add/edit queues and syncs on reconnect; deploy and smoke-test hosted URL. **Requires a real Firebase project (your action).**

### Task 8.1: PWA service worker
**Files:** modify `vite.config.ts`; `public/` icons.
- [ ] Add `VitePWA` (`registerType: 'autoUpdate'`, minimal `manifest`: name "SpendShare", theme color, icons). Workbox defaults precache app shell.
- [ ] Verify `npm run build && npm run preview` → SW registered + installable. Commit.

### Task 8.2: Offline verification
- [ ] Manual: preview, sign in online; DevTools → Offline; confirm list renders, add/edit queues locally, optimistic UI; back online → writes sync. Document in `README.md`. Commit.

### Task 8.3: Deploy to Firebase Hosting
- [ ] Add hosting to `firebase.json` (`public: dist`, SPA rewrite). `npm run build && npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes`.
- [ ] Add hosted domain to Auth → Authorized domains if Google sign-in blocked. Update `README.md` (live URL, setup, commands). Commit.

---

## End-to-end acceptance (v1 criteria → checks)
1. **Add expense** (date, shop, item, item amount, total, payer, shared) → M5.
2. **Add income** (monthly, per member) → M6.
3. **Summary** (per-person total, shared spending, who-owes-whom, mark paid) → M7.
4. **Offline read+edit, syncs to Firebase free tier** → M0.5 persistence + M8 offline test.
5. **Data bound to user; others can't read unless shared** → M2 rules + M2/M3 membership.

**Automated tests:** `npm test` (money, month, settlement + component tests). **CI** required-green on every PR.
**Process:** each milestone on its own branch, test-writer/implementer split, verifier (regression + webwright), merged only through green CI.

## Deferred / not in v1
Capacitor iOS/Android wrap; hardened field-level membership rules (owner-only member edits); multi-currency/FX; proportional-to-income splitting; per-month rollup docs if `collectionGroup` reads approach quota.
