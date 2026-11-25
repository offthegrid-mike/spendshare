# SpendShare Travel — Implementation Plan & Progress Tracker

> **Standalone, resumable plan.** Run it **one milestone at a time**. Each milestone ends with working software merged to `main`, so you can stop after any of them. Tick milestones off in the dashboard as they merge.

**Goal:** A **Travel** module inside SpendShare for shared trip costs. Trip members record what they spend in any currency, by card or from cash bought before or during the trip. Cash is held either in a **personal wallet** or in a shared **kitty**. The module values every payment in the trip's home currency and works out the fewest payments to settle up.

**Architecture:** Travel sits beside SpendShare and the Work tracker: a Home tile and its own routes under `/travel`. A trip is a group with `kind: 'trip'`, so auth, members, invites, members without an account, and the Firestore rules for groups carry over. All money math lives in pure, unit-tested modules under `src/lib/travel/`, which feed the existing `computeSummary` settlement algorithm.

**Tech stack:** Unchanged (Vite, React, TypeScript, Firebase, Zustand, zod, Tailwind, Vitest, Playwright).

---

## 📊 Progress dashboard

| Milestone | Status | Branch | Merged |
|-----------|--------|--------|--------|
| **T0** — Money foundations (minor units, split among chosen people) | 🔄 **In review** | `claude/eloquent-dijkstra-dtf9bi` (with this plan) | PR #17 (open) |
| **T1** — Trip groups and the Travel shell | 🔄 **In review** | `claude/eloquent-dijkstra-dtf9bi` | PR #17 (open) |
| **T2** — Trip expenses in foreign currency (card) | 🔄 **In review** | `claude/eloquent-dijkstra-dtf9bi` | PR #17 (open) |
| **T3** — Trip summary and settle-up | 🔄 **In review** | `claude/eloquent-dijkstra-dtf9bi` | PR #17 (open) |
| **T4** — Personal cash wallets | 🔄 **In review** | `claude/eloquent-dijkstra-dtf9bi` | PR #17 (open) |
| **T5** — Shared kitty | ⬜ | `travel/T5-kitty` | |
| **T6** — Cash hand-overs, closing a trip, export | ⬜ | `travel/T6-close` | |
| **T7** — Extras (live rates, budgets, foreign receipts) | ⬜ optional | `travel/T7-extras` | |

---

## ▶️ How to run this plan

Tell Claude **"Continue the Travel plan — do T<n>"**. Each milestone follows the conventions in `CLAUDE.md` and `IMPLEMENTATION_PLAN.md`:

- Before starting, check branch and PR status (`git fetch origin --prune`, open PRs). Branch fresh from `origin/main` for every milestone.
- Write failing tests first. Pure modules come first, then the hooks, then the UI.
- Merge gate: `npm run typecheck && npm run lint && npm run test && npm run build` pass, plus `npm run test:rules` when rules change. Functional check against the emulators with screenshots. CI green. `README.md` updated. Run the `code-review` skill before merging.
- Open a PR against `main`. Never merge locally.

---

## Confirmed product decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Where Travel lives | A **module inside SpendShare**: a Home tile, `/travel` routes, sharing auth, groups and the UI kit |
| 2 | What a trip is | A **new group** with `kind: 'trip'`, separate from the household groups |
| 3 | Cash model | **Both**: personal wallets and a shared kitty |
| 4 | Split types in v1 | **Even split among chosen people** (choose who shares each item) |

## Design decisions (proposed in this plan; confirm or change at T0)

1. **Cash is a payment method with a known cost.** Buying foreign cash locks in what it cost in home currency. A cash payment is valued at the **wallet's weighted average rate**: total home currency paid in ÷ total foreign cash received. The market rate on the day doesn't matter.
2. **Valuation is computed, not stored.** Trip items store their amount in the **expense's own currency**. A pure `valueTrip()` step converts everything to home currency when the summary is built. A later top-up changes a wallet's average rate, and stored home amounts would then go stale. Closing a trip (T6) freezes the values.
3. **Card payments** carry their own rate on the expense. Save it as *estimated* (the last rate used for that currency is remembered). When the statement arrives, replace it with the *actual* amount charged in home currency, fees included.
4. **Leftover cash in a personal wallet belongs to its owner** and never enters the split.
5. **Leftover cash in the kitty** is shared out **in proportion to the foreign cash each person put in**, valued at the kitty's average rate (so it splits into round cash amounts to hand back). Alternative at close: one person keeps all of it and the others are credited at the average rate.
6. **Amounts use each currency's minor unit**, from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`: JPY 0, AUD 2, KWD 3. Household screens keep their current cents helpers unchanged.
7. **`sharedWith` missing means everyone.** Household items don't set it, so household behaviour and data stay exactly as they are.

---

## Worked examples (these become test fixtures)

All in A$ for a trip to Japan with Alex, Ben and Chris.

**A. Personal wallet, two exchanges at different rates**
- Alex buys ¥50,000 for A$500 (0.0100), then ¥50,000 for A$530 (0.0106). Average rate: A$1,030 / ¥100,000 = 0.0103.
- Alex pays ¥60,000 cash for a dinner shared by all three. 60,000 × 0.0103 = A$618, or A$206 each.
- Ben owes Alex A$206 and Chris owes Alex A$206. The ¥40,000 left over (worth A$412) is Alex's own money. Check: 618 + 412 = 1,030.

**B. Shared kitty**
- Alex puts in A$300 (¥30,000), Ben puts in A$300 (¥30,000), and Chris puts in A$420 (¥40,000, bought at an airport rate). Kitty: ¥100,000 for A$1,020, so the average is 0.0102.
- The kitty pays ¥50,000 for a dinner shared by all three (A$510, A$170 each) and ¥30,000 for a museum visit shared by Alex and Ben (A$306, A$153 each).
- That leaves ¥20,000 (A$204). By foreign cash put in, it's shared out as Alex ¥6,000 (A$61.20), Ben ¥6,000 (A$61.20) and Chris ¥8,000 (A$81.60).
- Credit = put in − leftover handed back: Alex 238.80, Ben 238.80, Chris 338.40 (these add up to 816 = 510 + 306).
- Balances: Alex 238.80 − 323 = −84.20; Ben −84.20; Chris 338.40 − 170 = +168.40.
- Settle up: Alex pays Chris A$84.20 and Ben pays Chris A$84.20.

**C. Card with an estimated rate, corrected later**
- Ben pays ¥15,000 for a hotel tax by card, shared by Ben and Chris. Estimate at 1 A$ = ¥99: A$151.52.
- Ben's statement later shows A$155.10. Ben enters it, the rate becomes actual (1 A$ = ¥96.71), and Chris's share becomes A$77.55.

**D. Paying back in leftover yen (T6)**
- Ben owes Alex A$206. Ben hands Alex ¥20,000 from his own wallet, whose average rate is 0.0102. That counts as A$204, so Ben still owes A$2.00. Alex's wallet gains ¥20,000 at a cost of A$204.

---

## Data model changes

```ts
// GroupDoc (src/types/models.ts)
kind?: 'trip';                     // missing = household
trip?: { startDate: string; endDate: string }; // 'YYYY-MM-DD'; the rules allow no other keys
tripClosedAt?: Timestamp;          // T6: set when the trip is closed (a top-level field)
// currency stays the trip's HOME currency

// ExpenseDoc: trip expenses only
currency?: string;                 // the expense's own currency; missing = group currency
tripDay?: string;                  // 'YYYY-MM-DD' as chosen, so members in other time zones see the same day
paidWith?:
  | { kind: 'card'; rate: number; rateStatus: 'estimated' | 'actual'; homeTotal?: number }
  //   rate is "1 home = rate foreign" (1 A$ = ¥99), as exchange boards show it
  | { kind: 'wallet'; walletId: string };   // a personal wallet or the kitty
// payerUid: for a kitty payment, whoever carried the cash; the kitty is the one credited

// ItemDoc
sharedWith?: Uid[];                // missing = every member; only meaningful when shared
// amount: on a trip item it's in the expense's currency (minor units)

// groups/{gid}/wallets/{ownerUid_CUR}: one wallet per person per currency (T4).
// T5 adds kind 'kitty'; the rules allow only 'personal' until then.
interface WalletDoc {
  id: string; kind: 'personal';
  ownerUid: Uid; currency: string; createdByUid: Uid; createdAt: Timestamp;
}
// groups/{gid}/topUps/{id}: a flat collection, so a trip loads all its cash in one query.
interface TopUpDoc {
  id: string; walletId: string; byUid: Uid; date: string; createdAt: Timestamp;
  foreignAmount: number;           // minor units of the wallet's currency (> 0, whole)
  homeAmount: number;              // minor units of the home currency (>= 0, whole)
  // T6 may add source ('exchange' | 'handover' | 'returned') and fromWalletId; the rules allow no other keys yet.
}
```

Settlement docs for a trip use `month: 'trip'` and the id `trip_${from}_${to}`, so `markSettlementPaid` can be reused unchanged.

---

# T0 — Money foundations

Pure modules with no UI. Everything later depends on these.

### Task 0.1: Minor-unit money helpers (`src/lib/travel/currency.ts`)
- `minorDigits(currency)`, `toMinor(input, currency)`, `formatMinor(amount, currency)` and `currencyOptions()` (a curated list of common travel currencies with names).
- Tests: JPY "1500" → 1500, AUD "12.5" → 1250, KWD "1.234" → 1234; formatting for each; a negative gets the true minus sign, as `formatMoney` does.

### Task 0.2: Split among chosen people in `computeSummary`
- `SummaryItem` gains `sharedWith?: string[]`. Group shared amounts by the sorted set of sharers, sum each set, then `distributeEvenly` once per set, which keeps rounding to at most a minor unit per set.
- A sharer who isn't a current member still gets a share (a removed member's debt shouldn't vanish).
- Tests: an item with no `sharedWith` behaves exactly as today (keep every existing `settlement` test green); the museum case from example B; an indivisible amount rounding; a refund with `sharedWith`.

### Task 0.3: Wallet rate and valuation (`src/lib/travel/wallet.ts`)
- `walletRate(topUps)` returns `{ home, foreign }` sums, never a float.
- `valueCash(foreignAmount, rate)` = `Math.round(foreign × home / foreign)` in integer math.
- `walletBalance(topUps, spends)` returns foreign cash left and its home value.
- Tests: example A; no top-ups (no rate; the caller shows a warning); spending more than was put in (a negative balance is reported, not hidden).

---

# T1 — Trip groups and the Travel shell

### Task 1.1: Trip groups
- `createTrip(name, homeCurrency, startDate, endDate)` in `src/lib/travel/createTrip.ts` (modelled on `createGroup.ts`; seeds travel categories: Accommodation, Transport, Food, Activities, Shopping, Fees, Other).
- `useTrips()` lists groups with `kind === 'trip'`. `useGroups()` and the household `GroupSwitcher` leave trips out.
- **Rules:** `kind` is set at create and can never change. The owner may update `trip`. Add `trip` to the owner's editable keys. Rules tests cover both.

### Task 1.2: Shell, routes and Home tile
- `paths.travel = '/travel'` with `/travel/:tripId`, `/travel/:tripId/expense/new`, `/travel/:tripId/summary`, `/travel/:tripId/wallets` and `/travel/:tripId/settings`.
- A `TRAVEL_ENABLED` flag in `features.ts`: on in development, and in production only with `VITE_TRAVEL_ENABLED=true`, so milestones can merge (every merge deploys) before Travel is usable. A **Travel** tile on Home: the current or next trip and which day of it today is. Its total so far and your balance are added in T3, once there are expenses.
- Trip list screen: upcoming, current and past trips, plus **New trip**.
- Trip settings reuse the group settings' members section (extracted as `MembersSection`) and `SendInvite`: name (any member), dates (owner only), members, invites, members without an account. The home currency is fixed once the trip exists.
- A trip invite carries `groupKind: 'trip'`, so accepting it doesn't switch the selected household.

**Acceptance:** create a trip, invite a member, add a member without an account, and see it on Home. The household switcher still shows only households.

---

# T2 — Trip expenses in foreign currency (card)

### Task 2.1: Editor
- **Built as its own `TripExpenseEditor`**, not a trip mode of `ExpenseEditor` (decided in T2). The household editor is 967 lines of cents-only logic, drafts, refunds, group switching, receipt scanning, gift cards and discounts, and a trip mode would have put currency checks through all of it. The trip editor reuses `DatePicker`, `PayerPicker`, `Select`, `Checkbox` and `useCategories`.
  - a **currency** picker on the expense, defaulting to the last currency used on this trip;
  - for a foreign currency, an **exchange rate** typed as "1 AUD = 99 JPY", prefilled from the last rate for that currency and marked *estimated*;
  - **Who shares this** on each shared item: member chips, all on at first; a new item starts with the item before it's people. A shared item always stores its sharers, so someone who joins later isn't added to what was already split.
  - a live total in the expense's currency and its estimate in the home currency.
- Saves don't wait for the server while offline (`settleWrite`), unlike the household editor.
- Every write records its editor as `createdByUid`, because the expense rules bind each write to its author.
- **Not in T2:** autocomplete, tags, drafts, remarks and quantities. Price history is left out on trips (prices in different currencies don't compare). Paying from a wallet comes with T4.

### Task 2.2: List and detail
- Trip list grouped by **day of the trip** ("Day 3 · Wed 12 May"; days outside the trip say before or after it), with **Spent so far** in the home currency.
- Each row shows the original amount, with the home value below it. An estimated rate shows an "Estimated" chip.
- Detail page: items with who shares them, and **Amount charged** turns an estimated card rate into the actual one (example C). It can be changed later. Edit and Delete (with a confirmation).
- An edit that keeps the currency and total keeps the amount charged; one that changes either goes back to an estimate.

### Task 2.3: Rules
- Expense: `currency` is a 3-letter upper-case code; `paidWith` is a card (`rate` > 0, `rateStatus` estimated or actual, optional `homeTotal` >= 0, no other keys) or a wallet (`walletId`, no other keys).
- Item: `sharedWith`, when present, is a list of 1 to 20 entries.

---

# T3 — Trip summary and settle-up

### Task 3.1: `valueTrip()` (`src/lib/travel/valueTrip.ts`, pure) — done
- Takes the trip's expenses and items. Returns items in home currency for `computeSummary`: a card payment's home value (`homeTotal` if charged, else its estimate) is spread over its items in proportion (`spreadInProportion`, exact to the minor unit). Also returns the payments still estimated and those that can't be valued yet (wallet payments until T4, which adds wallets and top-ups here).
- **Parties** are the members plus anyone who paid or shares an item and has since left. So a former member who paid is paid back, and balances add up. That settles the T0 risk for trips without changing household settle-up.
- Tests: example C, proportional spread, a former member, a wallet payment, settlements already paid.

### Task 3.2: Summary screen — done
- `/travel/:tripId/summary`: settle-up first (`markSettlementPaid` with `month: 'trip'`, through `settleWrite` so it works offline; Undo), then each person's balance, paid and share, then spending by category and by the currency paid in. It's its own component, because the household Summary formats money in cents, which is wrong for a home currency like JPY.
- A banner lists card payments still on estimated rates, linking to each one.
- Someone who has left the trip shows as "A former member" (their name leaves with them).
- The trip page shows your balance with a link to settle up; the Home tile adds spent so far and your balance.
- **Not in T3:** totals by day (the trip page already lists expenses by day). For T4: value cash payments with `valueSpends` (cumulatively, in date order), not `valueCash` one at a time, so rounding doesn't drift from what was paid in.

**Acceptance:** example C settles as expected, and marking it paid and undoing it both work.

---

# T4 — Personal cash wallets

### Task 4.1: Cash screen — done
- `/travel/:tripId/cash` (linked from the trip page): a card per wallet with cash left, what it cost, the average rate ("1 AUD = 97.09 JPY"), what was bought and spent, and each top-up with Remove. A wallet spent beyond its cash, or with no cash added yet, says so.
- **Add cash**: whose cash (any member, including one without an account), currency (any but the home one), cash received, what was paid in the home currency, and the date. It shows the rate this works out to, and creates the wallet the first time, in the same batch.

### Task 4.2: Paying from a wallet — done
- The editor's **Paid with** is Card or Cash. Cash offers the wallets in the expense's currency (yours first); the wallet's owner becomes the payer, and there's no rate to enter. A warning shows when the payment is more than the cash left (it's still saved).
- `tripCash` values every cash payment at its wallet's average rate, cumulatively in the order spent (day, then when added) with `valueSpends`, so spending plus what's left always equals what the cash cost. The list ("Cash" chip), detail, summary, trip page and Home tile all use these values. A payment from a wallet with no cash added stays out of the balances, and says so.
- `useTripData` combines a trip's expenses and wallets for every screen.
- **Not in T4:** refunds (trips have none yet).

### Task 4.3: Rules — done
- Wallets: members only; `kind` 'personal'; the id is `ownerUid_CUR`; the owner is on the trip; owner and currency never change.
- Top-ups: members only; written by their author (`byUid`); whole amounts, `foreignAmount > 0` and `homeAmount >= 0`; an ISO date; into a wallet that exists once the batch lands; no other keys.

**Acceptance:** example A gives Ben and Chris A$206 each to pay Alex, and the wallet shows ¥40,000 left at 0.0103.

---

# T5 — Shared kitty

### Task 5.1: Kitty wallet
- One kitty per currency per trip, created from the Wallets screen. **Put in** records a contribution (a top-up with `byUid`).
- Kitty card: cash left, average rate, and each person's contribution in both currencies.

### Task 5.2: Kitty in the settlement (`src/lib/travel/kitty.ts`, pure)
- Each contributor is credited with what they put in, minus their share of the leftover cash (decision 5). The kitty's spending is shared among each item's `sharedWith`.
- `valueTrip()` returns the kitty credits as extra paid amounts per member, so `computeSummary` still produces balances that add up to zero.
- Tests: example B exactly; a kitty with nothing left; a member who put nothing in but shares costs; two kitties in different currencies.

### Task 5.3: UI
- **Paid with → Kitty (¥)** in the editor, and the person carrying the cash is recorded.
- Summary shows a "Kitty" line: put in, spent, and left over with each person's cash to hand back.

**Acceptance:** example B gives two payments of A$84.20 to Chris, and the kitty screen shows the ¥6,000 / ¥6,000 / ¥8,000 hand-back.

---

# T6 — Cash hand-overs, closing a trip, export

### Task 6.1: Settle up in foreign cash
- On a settle-up line, **Pay in cash (¥)** moves cash from the payer's wallet to the receiver's (creating the receiver's wallet if needed). It's valued at the payer's average rate and recorded as a top-up with `source: 'handover'` (example D).

### Task 6.2: Close the trip
- **Close trip** (owner only) freezes all valuations into `homeTotal` on each expense, sets `tripClosedAt`, and makes the trip read-only in the app and in the rules. The owner can reopen it.
- Kitty leftover: choose **share out** (the default) or **one person keeps it** (decision 5).

### Task 6.3: Export
- CSV with one row per item: date, shop, item, category, currency, original amount, rate, home amount, paid with, payer, and who shared it. A second file with wallets and top-ups.

---

# T7 — Extras (optional, pick any)

- **Live rates:** a `/rates` endpoint in the Cloudflare worker that caches a daily rates feed. It prefills the card rate, and the app caches the last rates for use offline.
- **Budgets:** a trip budget and a daily budget per category, reusing `budget.ts`.
- **Foreign receipts:** check receipt scanning on Japanese, Korean and Thai receipts, and detect the currency from the receipt.
- **Weighted and exact splits:** shares or exact amounts per person, building on the `sharedWith` structure.
- **Members for part of a trip:** join and leave dates, so the "who shares" chips default to the people present that day.
- **Move to household:** after the trip, add each person's net cost as a personal or shared expense in their household group.

---

## Risks and open questions

- **Values move while a trip is open.** A late top-up changes a wallet's average rate, which changes earlier cash values. This is correct, but may surprise people. Show "values update as cash is added", and freeze them at close.
- **`ItemDoc.amount` means different things.** In a household it's cents in the group currency. On a trip it's minor units of the expense's currency. Every trip screen must format with the expense currency. A test helper should fail if a trip item is formatted with `formatMoney`.
- **Collection-group queries on items** (year summary, search) are scoped per group, so trip items don't leak into household totals. Check this again in T1.
- **A former member who paid for something** (found in T0 review): **fixed** in the PR #17 review. `computeSummary` counts any payer or sharer who has left as a party, so they're paid back and balances add up, in households and trips alike, and they show as "A former member". Households with such a payer see a new "pay back" line in settle-up for those months.
- **Turning Travel on in production** (found in T1 review): a client still running a cached version from before T1 doesn't know `kind`, and would list trips as households. Before setting `VITE_TRAVEL_ENABLED=true` in production, make sure the deployed version has been live long enough for installed apps to update.
- **Offline creation of a trip**: **fixed** in the PR #17 review. `createGroup`, trip settings and member changes go through `settleWrite`, so they return at once offline. Invites still need a connection.
