# Security Review — SpendShare

**Date:** 2026-06-10
**Reviewer:** Claude Code (security-review skill)
**Scope:** Full codebase on `main`. SpendShare is a client-only React 19 + TypeScript + Vite app backed by Firebase Auth + Firestore. There is no custom server, so `firestore.rules` is the sole server-side authorization boundary. The review focused there, with a sweep of `src/`, `firebase.json`, and deployment config.
**Status:** Findings only — no fixes applied (deferred to next session).

## Summary

Three authorization findings, all in `firestore.rules`, all confirmed exploitable at high confidence. The client (React) correctly gates sensitive actions (e.g. owner-only member removal), but those checks are client-side only and trivially bypassed by calling the Firestore SDK directly from the browser console. The rules do not back them up.

| # | Severity | Category | Location |
|---|----------|----------|----------|
| 1 | High | Privilege escalation / authorization bypass | `firestore.rules:37` |
| 2 | Medium | IDOR / PII disclosure | `firestore.rules:27` |
| 3 | High | Authorization bypass (group takeover) | `firestore.rules:40-43` |

Areas checked and found sound: expense/income/item/settlement subcollection access (all gated by `isMember`), group `create` (forces `ownerUid == auth.uid`), invite creation, collection-group invite/item reads, absence of unsafe DOM patterns (`dangerouslySetInnerHTML`, `eval`, `innerHTML`), secrets (only the public Firebase web config), and `localStorage` (UI state only). `firebase.json` hosting has no insecure rewrites. No CI workflows or cloud functions exist.

---

## Vuln 1: Privilege escalation — unrestricted group `update` for members — `firestore.rules:37`

* **Severity:** High
* **Category:** authorization_bypass / privilege_escalation
* **Confidence:** 0.9

**Description.** The group `update` rule's first branch is `allow update: if isMember(groupId)` with no `affectedKeys()` constraint and no `request.resource.data` validation. Because the rule is an OR of branches, any member who satisfies `isMember` can overwrite **any field** of the group document — including `ownerUid`, `members`, and `memberUids` — regardless of the more carefully scoped self-join branch below it.

```
allow update: if isMember(groupId)
  || ( signedIn() && ... affectedKeys().hasOnly(['members','memberUids']) ... );
```

The React client (`GroupSettings.tsx`) gates ownership actions behind `isOwner`, but that is client-side only.

**Exploit Scenario.**
1. UserB is a non-owner member of group G (joined normally).
2. In the browser console: `updateDoc(doc(db,'groups','G'), { ownerUid: '<userB-uid>' })`. The `isMember('G')` branch passes.
3. UserB is now `ownerUid`, satisfies `isOwner` (line 44), and can delete the group or rewrite `members`/`memberUids` to evict the original owner, revoking their access to all expenses, income, and settlements.

**Recommendation.** Split the update rule. Allow ordinary edits (e.g. `name`, `currency`) for members via `affectedKeys().hasOnly([...])`, hold `ownerUid` immutable (`request.resource.data.ownerUid == resource.data.ownerUid`), and restrict membership/owner-management mutations to `isOwner(groupId)` plus the existing invite-accept self-join branch.

---

## Vuln 2: Any authenticated user can read every user document — `firestore.rules:27`

* **Severity:** Medium
* **Category:** idor / pii_disclosure
* **Confidence:** 0.85

**Description.** `match /users/{uid} { allow read: if signedIn(); }` grants every authenticated user read (`get` **and** `list`) access to every user document. Per `UserDoc` (`src/types/models.ts`), these contain `email`, `displayName`, `photoURL`, and `memberOf` (the user's full list of groups). The app only ever reads the current user's own doc (`useAuth.ts`, `useInvites.ts`), so the broad grant is not required by any feature.

**Exploit Scenario.**
1. Attacker creates an account and signs in.
2. From the console, a collection query on `/users` (allowed because `list` only requires `signedIn()`) dumps every user's email, display name, and group-membership graph in one request.
3. Result: full email/PII harvest plus a social graph of who shares groups with whom — usable for phishing and targeting.

**Recommendation.** Restrict reads to the owner: `allow read: if signedIn() && request.auth.uid == uid;`. If a future feature needs lookup-by-email, expose only minimal fields via a purpose-built path.

*Note:* exposure depth depends on which auth providers are enabled — an unverified-email signup path opens this to any outsider; verified-only providers limit it to "any registered user." Either way it over-exposes emails and the social graph.

---

## Vuln 3: Invite-accept self-join can evict all existing members — `firestore.rules:40-43`

* **Severity:** High
* **Category:** authorization_bypass (group takeover)
* **Confidence:** 0.8

**Description.** The self-join branch requires only `affectedKeys().hasOnly(['members','memberUids'])`, that the caller was not previously a member, and that the caller is in the new `members` map. It does **not** require existing members/memberUids to be preserved, so the joiner can rewrite the entire map — `hasOnly` constrains *which keys* change, not their *contents*. The one limiter is that a `pending` invite must exist at `groups/{groupId}/invites/{myEmail}`.

```
&& affectedKeys().hasOnly(['members', 'memberUids'])
&& !(request.auth.uid in resource.data.members)
&& request.auth.uid in request.resource.data.members
&& get(.../invites/$(myEmail())).data.status == 'pending'
```

**Exploit Scenario.**
1. UserC holds a legitimate pending invite to group G (any existing member can create invites, line 47).
2. Instead of an additive `arrayUnion` accept, UserC calls `updateDoc(doc(db,'groups','G'), { members: { '<userC-uid>': {...} }, memberUids: ['<userC-uid>'] })`.
3. The rule passes, wiping every existing member — including the owner — from `members`/`memberUids`. Since read and subcollection access are gated by `memberUids`/`isMember`, the owner and all members lose access to the group and its expense/income/settlement data. (`ownerUid` is unchanged, so the owner retains only `delete`.)

**Recommendation.** Make the join strictly additive: require the new sets to be supersets of the old (`request.resource.data.memberUids.hasAll(resource.data.memberUids)` and the `members.keys()` equivalent), assert the diff adds only the caller's own uid, and keep `ownerUid` unchanged.

---

## Suggested fix priority

1. **Vuln 2** (`/users` read) — lowest-effort, highest blast radius (PII of all users); one-line rule change.
2. **Vuln 1** (group `update`) — add `affectedKeys` / owner constraints; prevents owner hijack.
3. **Vuln 3** (self-join) — add subset/superset constraint to the join branch.

All three are fixes to `firestore.rules` only. Recommend extending the emulator-based two-account checklist (top of the rules file) with negative tests for each: non-owner cannot change `ownerUid`, a signed-in user cannot read another user's doc, and an invite-accept cannot drop existing members.
