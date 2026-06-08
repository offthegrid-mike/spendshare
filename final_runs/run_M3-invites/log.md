# M3 Invites — Functional Verification

- Branch: `milestone/M3-invites`
- Date: 2026-06-07
- Environment: macOS, Firebase Local Emulator Suite (Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080), project `demo-spendshare`
- Dev server: `npm run dev:emulator` at http://localhost:5173
- Driver: Playwright (Python, Firefox headless) — `verify.py`
- Test accounts: `alice+<ts>@test.com` / `bob+<ts>@test.com` (password `Test1234!`)

## Acceptance (from the plan)
> A invites B's email; B signs in, sees pending invite, accepts, can now read A's group.

## Checkpoints — all PASS
- **CP1** — A creates an account and a first group ("Trip Fund"); GroupSwitcher shows it.
- **CP2** — A opens the Invite page (`/group/invites`), invites B's email; the outgoing invite is listed with status `pending`.
- **CP3** — B creates an account (lands on the create-group screen) and, after email verification, sees the pending invite banner for "Trip Fund" with an Accept button.
- **CP4** — B clicks Accept; the membership batch commits and B can now read A's group "Trip Fund" (it appears in B's GroupSwitcher; B leaves the create-group screen).

Final run: **No console or page errors observed.**

## Notes on email verification
The accept security rule requires `request.auth.token.email_verified == true`. The script
verifies B's email via the Auth emulator OOB endpoint
(`/emulator/v1/projects/demo-spendshare/oobCodes` → GET the `oobLink`), then re-signs-in B in
a fresh browser context to mint an ID token carrying `email_verified=true` (the create-group
screen has no sign-out control, so a new context is the clean way to refresh the token).

## Bugs found and fixed during verification
1. **Invitee with no groups never saw the banner.** App routed a zero-group user straight to
   `CreateGroup`, bypassing `Layout` where `PendingInvites` lives — so the acceptance flow was
   impossible. Fixed by surfacing `PendingInvites` on the no-groups screen (App.tsx).
2. **Collection-group read denied by security rules.** B's `collectionGroup('invites')` query was
   denied ("No matching allow statements") because the nested `groups/{groupId}/invites` rule
   isn't reachable for a collection-group query (its `isMember(groupId)` branch calls `get()` on
   the unbound `groupId` wildcard). Added a dedicated recursive-wildcard read rule
   (`match /{path=**}/invites/{inviteId}`) keyed on `resource.data.email == myEmail()`.
3. **Project ID mismatch (writes never persisted).** The app ran with `projectId=placeholder`
   while the emulator/rules use `demo-spendshare`. With `persistentLocalCache`, `addDoc` resolved
   optimistically from cache (so A's UI looked correct) but writes never landed in the namespace
   that rules/reads use, so B's fresh context saw nothing. Fixed by pinning
   `VITE_FB_PROJECT_ID=demo-spendshare` in the `dev:emulator` script.
4. **Unhandled transient snapshot error.** `useGroup` logged `permission-denied` to the console
   while a just-accepted membership propagated. Added an `onSnapshot` error callback mirroring
   `useGroups` (clears loading; next snapshot resolves it).

## Final status: PASS
All four acceptance checkpoints passed with assertions (not just screenshots), clean console.
Screenshots: `screenshots/01_*` … `06_B_accepted_in_group.png`.
