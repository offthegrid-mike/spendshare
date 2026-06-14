# SpendShare — Security Assessment / Penetration Test Report

**Engagement type:** Independent gray-box security review (source-available)
**Date:** 2026-06-10
**Target:** SpendShare — React/Vite SPA on Firebase (Firestore + Firebase Auth, Firebase Hosting)
**Reviewer:** Independent security engineer
**Scope:** Firestore security rules (`firestore.rules`), client data-access layer (`src/`), auth flow, build/hosting config, dependencies. No live production testing was performed; findings are derived from source review and the rules unit-test harness.

---

## 1. Executive summary

SpendShare is a serverless application: there is **no backend tier**. The browser talks directly to Firestore, so the **Firestore security rules are the entire authorization boundary**. Anything the rules permit, a hostile client can do — the React code (`isOwner` checks, hidden buttons, client-side validation) provides **zero** security and can be bypassed trivially by calling the Firebase SDK directly from a console.

The good news: the core tenant-isolation model is sound. Non-members cannot read or write a group's data, the recent hardening against owner-hijack and member-eviction during invite acceptance holds, per-user documents are properly locked down, and there are no committed secrets, no dependency CVEs (`npm audit` clean), and no obvious XSS sinks.

The weaknesses are concentrated in two areas: **(a) the invite/membership state machine**, where an invitee has more power than intended, and **(b) the complete absence of field-level validation** on the financial sub-collections, where the in-group trust model is "any member can write anything." For an app that tracks money owed between people, the integrity gaps in (b) are material.

### Findings at a glance

| # | Severity | Title |
|---|----------|-------|
| H-1 | **High** | Invite acceptance can add arbitrary UIDs to a group (not just the accepting user) |
| M-1 | Medium | Revoked/declined invites can be resurrected by the invitee, defeating revocation |
| M-2 | Medium | No write validation on financial sub-collections (income/expenses/settlements tamperable by any member) |
| M-3 | Medium | `members` map vs `memberUids` array divergence — two sources of truth for membership |
| L-1 | Low | Invite read/write is gated on email match but **not** `email_verified` |
| L-2 | Low | No security response headers (CSP, X-Frame-Options, HSTS, etc.) on Firebase Hosting |
| L-3 | Low | App functions fully for unverified email/password accounts |
| I-1 | Info | Member income (salary) is readable by all group members |
| I-2 | Info | Firebase web config is public (expected); no Cloud Storage rules in repo |

---

## 2. Architecture & trust model

- **Client:** React 19 SPA (Vite). Routes/components gate UI but enforce nothing.
- **Auth:** Firebase Auth — Google sign-in + email/password (`src/features/auth/SignIn.tsx`).
- **Data:** Firestore, accessed directly from the browser via the Firebase JS SDK.
- **Authorization:** `firestore.rules` only.

**Trust boundaries:**
1. Unauthenticated ↔ authenticated — enforced well.
2. Group member ↔ non-member — enforced well (tenant isolation).
3. **Within a group, all members are fully trusted** — this is where the integrity findings live.

> **Methodology note:** Because the client is untrusted, every finding below assumes an attacker who calls the Firestore SDK directly with arbitrary payloads — not someone limited to the app's UI. This is the correct threat model for any Firebase web app and is easy to reproduce from the browser devtools console.

---

## 3. Findings

### H-1 — Invite acceptance can add arbitrary UIDs to a group (not just the accepting user)

**Severity:** High · **Component:** `firestore.rules` lines 46–54 (invite-accept branch)

The invite-acceptance branch of the group `update` rule was hardened to be "strictly additive" so that an invitee cannot evict existing members (tested in `tests/firestore.rules.test.ts`). However, the additive constraints only ensure that *nothing is removed* and that exactly **one** UID is added to `memberUids`. They do **not** ensure that the added principal is the accepting user, nor do they bound additions to the `members` map.

The branch checks:

```
&& !(request.auth.uid in resource.data.members)          // I am not already a member (map keys)
&& request.auth.uid in request.resource.data.members      // I appear in the new members map
&& <invite for my email is 'pending'>
&& request.resource.data.memberUids.toSet().hasAll(resource.data.memberUids)  // superset
&& request.resource.data.memberUids.size() == resource.data.memberUids.size() + 1  // exactly +1
&& <no existing members-map key removed>
```

**What is *not* enforced:**
- That `request.auth.uid` is the UID added to `memberUids`. The "+1" element of `memberUids` may be **any** UID (e.g. a colluding or attacker-controlled account), while the accepting user adds themselves only to the `members` map.
- That `members`-map *additions* are limited to the accepting user. An invitee can add **many** arbitrary UIDs as keys in the `members` map in a single accept.

**Impact:** A user holding a single valid pending invite can:
- Grant an arbitrary external account **read** access to the entire group by injecting its UID into `memberUids`, and/or
- Grant arbitrary accounts **write** access to every group sub-collection (expenses, income, settlements, categories, invites — `isMember()` keys off the `members` map; see M-3) by injecting their UIDs into the `members` map.

This bypasses the group owner's exclusive control over membership. One invite becomes an onboarding vector for any number of unauthorized accounts.

**Reproduction (conceptual):** As an invited, email-verified user with a pending invite, issue a single `updateDoc` on the group that (1) adds your own UID to `members`, (2) adds `attackerUid` to `memberUids` as the single new element, and optionally (3) adds extra keys to `members`. All additive checks pass.

**Recommendation:** Tighten the branch so the accepting user is the *only* principal added:
- Require `request.auth.uid in request.resource.data.memberUids` and that the single new `memberUids` element equals `request.auth.uid`.
- Require the `members`-map key-set difference (new − old) to equal exactly `{request.auth.uid}`.
- Optionally pin the new member's `role` to `'member'`.

---

### M-1 — Revocation/decline of invites is reversible by the invitee

**Severity:** Medium · **Component:** `firestore.rules` lines 57–61; `src/hooks/useInvites.ts`

The nested invite rule grants the invitee `write` on their own invite document:

```
match /invites/{inviteId} {
  allow create: if isMember(groupId);
  allow read, write: if isMember(groupId)
    || (signedIn() && resource != null && resource.data.email == myEmail());
}
```

`write` covers update and delete. `revokeInvite()` and `declineInvite()` simply set `status` to `'revoked'`/`'declined'`. Because the invitee still matches `resource.data.email == myEmail()`, they can `updateDoc` the same invite to set `status` back to `'pending'` — and then satisfy the invite-accept branch (H-1), which only checks `status == 'pending'`.

**Impact:** An owner's revocation of an invite is **not durable**. A previously-invited (then revoked) user can unilaterally resurrect the invite and join. Combined with H-1, this is a robust membership-control bypass.

**Recommendation:** Restrict the invitee's write to a status transition into terminal states only (e.g. allow setting `accepted`/`declined`, never back to `pending`), or move accept/revoke into a Cloud Function / callable with server-side state checks. At minimum, forbid invitee writes that set `status == 'pending'`.

---

### M-2 — No field validation on financial sub-collections

**Severity:** Medium · **Component:** `firestore.rules` lines 62–68

All money-bearing sub-collections use a single blanket rule:

```
match /categories/{categoryId}    { allow read, write: if isMember(groupId); }
match /expenses/{expenseId}        { allow read, write: if isMember(groupId);
  match /items/{itemId}            { allow read, write: if isMember(groupId); } }
match /income/{incomeId}           { allow read, write: if isMember(groupId); }
match /settlements/{settlementId}  { allow read, write: if isMember(groupId); }
```

There is **no** schema/field validation, no type checking, and no binding of records to their author. Any group member can, via direct SDK calls:

- **Overwrite another member's income** (`income/{uid}_{month}` — see `IncomeEditor.tsx`), distorting the income-proportional split that the whole app is built around.
- **Forge or alter expenses** — set `payerUid`/`createdByUid` to another member, set arbitrary `total`/`amount` (no `number`/non-negative check), attribute spending to others.
- **Mark settlements paid** (`paid: true`) or rewrite `fromUid`/`toUid`/`amount`, effectively erasing debts they owe or fabricating debts others owe.

The Zod schemas in `src/types/models.ts` run **client-side only** and are not a control.

**Impact:** Within a group, the integrity model is "everyone is an admin of everyone's financial records." For a shared-expense ledger this enables undetectable financial tampering between members. Confidentiality across groups is intact; integrity within a group is not.

**Recommendation:** Add field validation in the rules: enforce types and ranges (`amount is int && >= 0`), pin `createdByUid`/`uid` to `request.auth.uid` on create, and restrict income writes to `incomeId` matching the caller's own UID (`incomeId == request.auth.uid + '_' + month` or a `uid == request.auth.uid` check). Consider making `settlement.paid` writable only by the paying/owed party.

---

### M-3 — `members` map vs `memberUids` array: two sources of truth

**Severity:** Medium · **Component:** `firestore.rules` lines 17–20, 32; data model

Membership is represented twice and the rules read them inconsistently:

- **Group reads** are gated on the `memberUids` **array** (line 32).
- **`isMember()`** — which gates every sub-collection write and the invite create rule — is gated on the `members` **map** keys (lines 17–19).

Nothing in the rules keeps these two structures synchronized; only client code (`acceptInvite`, `GroupSettings`) updates them together. The group `create` rule validates `memberUids.hasOnly([creator])` but places **no constraint on the `members` map**, and the invite-accept branch bounds `memberUids` (+1) but not `members` additions (see H-1).

**Impact:** The divergence is the mechanism that makes H-1 exploitable and creates a class of inconsistent states where a UID has write access (in `members`) but not read access (absent from `memberUids`), or vice-versa. It also makes the rules hard to reason about and audit.

**Recommendation:** Pick **one** canonical membership structure for authorization (preferably `memberUids`, since it's already query-indexed and used for reads) and have `isMember()`/`isOwner()` plus all additive checks reference it consistently. If both must exist for UI convenience, add a rule invariant that any membership-affecting write keeps `members` keys and `memberUids` in lock-step.

---

### L-1 — Invite read/write gated on email match but not `email_verified`

**Severity:** Low · **Component:** `firestore.rules` lines 59–60, 79–81

The invite-accept branch correctly requires `email_verified == true`, but the **invite-document** read/write rules and the **collection-group** invite read rule (`/{path=**}/invites/{inviteId}`) only check `resource.data.email == myEmail()`. Firebase email/password accounts can be created for **any** address without proving ownership (verification is a separate, optional step — `SignIn.tsx` sends the email but never enforces it).

**Impact:** An attacker who registers an *unverified* email/password account using a victim's email address can **read** pending invites addressed to that victim (leaking `groupName`, `invitedByName`, `invitedByUid`) and **tamper** with them (revoke/delete/flip status — denial of the invite). They cannot *join* (accept requires `email_verified`), so impact is limited to information disclosure and invite griefing.

**Recommendation:** Add `request.auth.token.email_verified == true` to the invite read/write conditions, consistent with the accept branch.

---

### L-2 — No security response headers on Hosting

**Severity:** Low · **Component:** `firebase.json` (hosting `headers`)

The hosting config sets only cache-control headers. There is no `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or `Strict-Transport-Security`. For a financial app, a CSP and framing protection are baseline defense-in-depth (and reduce the blast radius of any future XSS).

**Recommendation:** Add a `headers` block applying a strict `Content-Security-Policy`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security`. Note that Firebase Auth popups require allowlisting the auth domain in `connect-src`/`frame-src`.

---

### L-3 — App fully usable by unverified email/password accounts

**Severity:** Low · **Component:** `src/features/auth/SignIn.tsx`, app routing

`handleCreateAccount` sends a verification email but nothing gates app usage on `user.emailVerified`. An unverified user can create groups, expenses, etc. This is primarily a product/abuse concern (spam accounts, unverified identities in groups), bounded by L-1 for the invite path.

**Recommendation:** Decide a policy: either gate sensitive actions on `emailVerified`, or restrict to verified providers (Google) if email/password is not needed.

---

### I-1 — Member income (salary) readable by all group members

**Severity:** Informational · **Component:** `firestore.rules` line 67; `IncomeEditor.tsx`

Income documents (effectively salary figures) are readable by every group member, and the UI displays other members' income (`IncomeEditor.tsx` line 79). This appears intentional — the app computes income-proportional splits — but it is sensitive PII shared with all co-members and worth an explicit privacy decision/disclosure. (The *write* side of this is the integrity problem in M-2.)

**Recommendation:** Confirm this is by design and surface it to users. If only aggregate splits need to be shared, consider keeping raw income private and computing shares server-side.

---

### I-2 — Public Firebase config; no Cloud Storage rules in repo

**Severity:** Informational

- The Firebase web config in `.env.local` (API key, project IDs) is **not a secret** — it ships in the client bundle by design. `.env.local` is correctly git-ignored and not committed. No action needed beyond awareness; ensure the API key has Google Cloud API restrictions applied in the console.
- No `storage.rules` exists in the repo though a `storageBucket` is configured. The app has no file-upload feature, so this is likely unused — but if Cloud Storage is enabled in the console, verify its rules are locked down (default templates can be permissive) rather than relying on the absence of a UI.

---

## 4. What was tested and found solid

- **Tenant isolation:** Non-members cannot read/write a group or its sub-collections (`isMember`/`memberUids` gating). ✔
- **Per-user docs:** `/users/{uid}` readable/writable only by the owning UID; PII enumeration is blocked. ✔ (covered by rules tests)
- **Owner-hijack prevention:** Members cannot change `ownerUid`, rewrite `members`, or rewrite `memberUids` outside the additive invite path. ✔ (covered by rules tests)
- **Member-eviction prevention:** Invite acceptance cannot remove existing members. ✔ (covered by rules tests) — though it can still *over-add*; see H-1.
- **Dependencies:** `npm audit` reports 0 vulnerabilities across all severities. ✔
- **Client injection:** No `dangerouslySetInnerHTML`, `eval`, or other obvious DOM-XSS sinks in `src/`. ✔
- **Secrets:** No credentials or service-account keys committed; `.env*.local` and debug logs are git-ignored. ✔

---

## 5. Test-coverage gaps (rules)

`tests/firestore.rules.test.ts` covers user-doc isolation, owner-hijack, and member-eviction, but does **not** cover the issues above. Recommended additions:
- Invite-accept that adds a UID **other than** the caller to `memberUids` → must fail (H-1).
- Invite-accept that adds **extra** keys to the `members` map → must fail (H-1).
- Invitee resurrecting a `revoked` invite back to `pending` → must fail (M-1).
- A member overwriting **another** member's income / settlement / expense author → must fail (M-2).
- Negative/non-numeric `amount` and `total` writes → must fail (M-2).

---

## 6. Prioritized remediation

1. **H-1 + M-1 (membership state machine):** Re-scope the invite-accept branch to the accepting user only, and make revocation terminal. These are the highest-impact authorization gaps.
2. **M-2 (financial integrity):** Add field validation and author-binding to income/expenses/settlements rules.
3. **M-3 (membership model):** Converge on a single authoritative membership structure.
4. **L-1 / L-3 (email verification):** Require `email_verified` on invite read/write and decide a verification-gating policy.
5. **L-2 (headers):** Add CSP and framing/transport headers to Hosting.
6. **I-1 / I-2:** Confirm income-visibility intent; verify Cloud Storage rules if the bucket is enabled.

---

*Limitations: This is a source-and-rules review. Recommended next step is dynamic verification against the Firestore emulator (and a staging project) — reproducing H-1, M-1, and M-2 with two test accounts and direct SDK calls — to confirm exploitability and validate fixes.*
