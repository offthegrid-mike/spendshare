# Critical Points

- [x] CP1: App loads at localhost:5173 and shows auth page — step 01 screenshot
- [x] CP2: Sign up succeeds with new account income-test-{timestamp}@test.com — step 02 screenshot
- [x] CP3: Group "Income Test Group" created with currency AUD — step 03 screenshot
- [x] CP4: Income page loads with one row per group member (1 member) — step 04 screenshot
- [x] CP5: Enter 5000 for current month and click Save — step 07 screenshot shows 5000 in field
- [x] CP6: Switch to previous month — income field shows blank (no data for that month) — step 09 screenshot (May 2026, empty field)
- [x] CP7: Enter 3000 for previous month and click Save — step 11 screenshot
- [x] CP8: Switch back to current month — income field shows 5000.00 (per-month persistence confirmed) — step 13 screenshot (June 2026, field = 5000.00)

## Bugs Found and Fixed

1. **`useIncome.ts` line 22**: `snap.docs.map((d) => ({ ...d.data(), uid: d.id }))` incorrectly overrides the `uid` field with the composite document ID (`{uid}_{month}`). Fixed to `snap.docs.map((d) => d.data())`.

2. **`IncomeEditor` no remount on month change**: `IncomeEditor` used `react-hook-form` with `defaultValues` computed at mount time; switching months didn't reinitialize the form. Fixed by adding `key={selectedMonth}` to the `IncomeEditor` in `App.tsx` to force remount on month change.

3. **Race condition**: Even with key-remount, `IncomeEditor` could mount before `useIncome`'s Firestore snapshot returned, leaving form blank. Fixed by checking `loading` in `IncomeRouteWrapper` and showing `<div>Loading…</div>` until data is ready.
