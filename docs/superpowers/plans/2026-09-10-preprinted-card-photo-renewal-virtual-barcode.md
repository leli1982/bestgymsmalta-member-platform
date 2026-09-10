# Preprinted Card, Photo, Renewal & Virtual Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generated BGM membership numbers with scanned preprinted card barcodes while preserving permanent member identity, mandatory photo capture, renewal card verification, safe card replacement, reception access, and a member-app virtual barcode that exactly mirrors the currently active physical card.

**Architecture:** `bgm_members.id` remains the immutable person identity. A new card-credential lifecycle table owns opaque barcode values and their `reserved -> active -> retired` state; membership activation/renewal and card replacement reference the same permanent member UUID. Official member photos stay in private Supabase Storage and reception/member APIs expose only authorized short-lived delivery URLs. The staff UI has one fixed Gym Staff capability bundle, while Super Admin retains unrestricted access.

**Tech Stack:** Next.js 16 / React / TypeScript / Tailwind, Supabase Postgres + private Storage, existing system-session auth, Code 128 barcode rendering, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-10-gym-staff-member-photo-lifecycle-design.md`, `docs/superpowers/specs/2026-09-09-membership-number-xlsx-barcode-transition-design.md`, `docs/superpowers/specs/2026-09-10-membership-enrollment-activation-design.md`

## Global Constraints

- Work only on branch `phase-2-operations-nfc-redesign`.
- Do not commit directly to `main`.
- Do not migrate or deploy Production until Preview testing is explicitly approved.
- Development Supabase project only for schema/storage verification.
- Permanent member identity is `bgm_members.id`; card barcode is a replaceable credential, never the person primary key.
- Preserve scanned barcode payload exactly as text, including leading zeroes and letters.
- New membership: tablet captures details + mandatory official photo, then main reception screen assigns a preprinted card by scan.
- Renewal: the member must scan a card again before activation. Same active barcode means keep the card; a different unused barcode means replacement at activation and permanent retirement of the old card.
- Staff must also have a separate `Issue New Card` workflow for lost/stolen/damaged cards; this must not renew or extend membership.
- The member app virtual card must render the exact currently active physical-card barcode from the authenticated server-side member identity.
- Official member photos are private; never make the Storage bucket public.
- Application Staff Name and Activation Staff Name remain separately mandatory on NEW MEMBERSHIP and RENEWAL.
- Exact activation button copy: `PAYMENT RECEIVED — ACTIVATE`.
- Normal Gym Staff is a fixed role; no arbitrary permission editor for gym accounts.
- Super Admin has full access.
- Barcode access creates the canonical check-in only when access is granted and all required identity-photo gating is satisfied.
- Retired card barcodes must never grant access and must never be silently reassigned.

---

## File Map

### Existing files to modify

- `lib/systemPermissions.ts` — define canonical Gym Staff permission bundle.
- `app/api/admin/system-users/route.ts` — enforce fixed Gym Staff permissions server-side.
- `components/admin/SystemUsersAdmin.tsx` — remove arbitrary gym permission editing and show fixed-role summary.
- `components/staff/StaffLoginPage.tsx` — expose only approved daily Gym Staff tools and link Memberships to enrollment.
- `components/staff/MembershipEnrollmentPage.tsx` — finish route wiring; add mandatory photo capture state, main-screen handoff status, renewal card-scan requirement, and card replacement outcome.
- `app/api/system/members/enroll/route.ts` — persist photo/card requirements and reject activation until the correct preconditions are met.
- `app/api/system/members/search/route.ts` — return first/last names and current active card metadata needed by renewal.
- `app/api/system/barcode/scan/route.ts` — resolve active/retired credentials rather than member_number-only lookup; return secure member photo URL/state and photo-required gating.
- `components/staff/BarcodeReceptionPage.tsx` — show official photo; handle PHOTO REQUIRED and CARD REPLACED states.
- member virtual-card component/page found in current member-card flow — switch barcode source to authenticated active card credential.
- import/export code for current 16-column BGM transition workbook — rename/use leading `CardBarcode` and stop fabricating generated BGM values.

### New focused files to create

- `supabase/migrations/<timestamp>_member_card_credentials_and_photos.sql` — card credential schema, photo metadata/provenance, revised activation transaction, and retirement rules.
- `lib/memberCardCredentialCore.ts` — pure validation/state-decision helpers for scan/renewal/replacement.
- `app/api/system/members/card/assign/route.ts` — reserve/verify a preprinted card for a pending new/renewal application.
- `app/api/system/members/card/replace/route.ts` — standalone Issue New Card transaction for lost/stolen/damaged cards.
- `app/api/system/members/photo/route.ts` — authorized official-photo capture/update endpoint and private Storage coordination.
- `app/api/system/members/photo/[memberId]/route.ts` or equivalent secure photo delivery endpoint — authenticated short-lived delivery only.
- `app/api/member/card/route.ts` — authenticated member-side source of truth for current membership state and active barcode.
- `app/staff/members/enroll/page.tsx` — route wrapper for existing enrollment component.
- focused tests described below.

---

### Task 1: Finish the existing enrollment UI GREEN cycle without changing business semantics

**Files:**
- Create: `app/staff/members/enroll/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `app/api/system/members/search/route.ts`
- Test: `tests/membership-enrollment-ui-contract.test.mjs`
- Test: `tests/membership-enrollment-search-contract.test.mjs`

**Interfaces:**
- Consumes: existing `MembershipEnrollmentPage` and current enrollment/search API.
- Produces: `/staff/members/enroll` route, Members tile link, renewal search records containing explicit `firstName` and `lastName`.

- [ ] **Step 1: Update the existing UI contract test to require the real route and Members link.**

Add assertions that `app/staff/members/enroll/page.tsx` imports/returns `MembershipEnrollmentPage` and `StaffLoginPage` uses `href="/staff/members/enroll"` for the Members tool.

- [ ] **Step 2: Run the focused UI/search tests and verify RED for the missing route/link or missing explicit name fields.**

Run: `node --test tests/membership-enrollment-ui-contract.test.mjs tests/membership-enrollment-search-contract.test.mjs`

Expected: FAIL only on the newly asserted missing behavior.

- [ ] **Step 3: Add the route wrapper and Members link.**

```tsx
import MembershipEnrollmentPage from "@/components/staff/MembershipEnrollmentPage";

export default function StaffMembershipEnrollmentRoute() {
  return <MembershipEnrollmentPage />;
}
```

- [ ] **Step 4: Return `firstName` and `lastName` explicitly from renewal search instead of splitting `fullName` client-side.**

Keep `fullName` for display compatibility but add server-derived normalized first/last fields from `bgm_members.first_name` and `last_name`.

- [ ] **Step 5: Run focused tests and then full current CI test command.**

Expected: enrollment UI/search tests PASS; no regression in existing tests/typecheck/build.

- [ ] **Step 6: Commit.**

```bash
git add app/staff/members/enroll/page.tsx components/staff/StaffLoginPage.tsx app/api/system/members/search/route.ts tests/membership-enrollment-ui-contract.test.mjs tests/membership-enrollment-search-contract.test.mjs
git commit -m "feat: finish staff membership enrollment entry point"
```

---

### Task 2: Lock Gym Staff to one fixed operational role

**Files:**
- Modify: `lib/systemPermissions.ts`
- Modify: `app/api/admin/system-users/route.ts`
- Modify: `components/admin/SystemUsersAdmin.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Test: `tests/system-user-permissions.test.mjs`
- Test: `tests/gym-staff-role.test.mjs`

**Interfaces:**
- Produces: `GYM_STAFF_PERMISSIONS: readonly SystemPermissionKey[]` and server-enforced fixed assignment for all non-Super-Admin gym logins.

- [ ] **Step 1: Write failing tests for fixed Gym Staff access.**

Assert the canonical bundle includes only route capabilities required for Memberships, Reception/Barcode, official-photo view/capture, Sundries submit, and Bar submit, plus any minimal member view/search permissions those flows require. Assert it excludes analytics, imports/exports, system-user management, notification settings, order management/history, and arbitrary admin permissions.

- [ ] **Step 2: Run RED.**

Run: `node --test tests/gym-staff-role.test.mjs tests/system-user-permissions.test.mjs`

- [ ] **Step 3: Implement `GYM_STAFF_PERMISSIONS` in `lib/systemPermissions.ts`.**

The permission engine remains internally granular, but gym accounts always receive the canonical list server-side.

- [ ] **Step 4: Make system-user create/update ignore client-selected permissions for gym accounts and persist the canonical bundle.**

Super Admin accounts continue to use `isSuperAdmin` bypass.

- [ ] **Step 5: Remove the permission checkbox editor for gym accounts.**

Show a read-only “Gym Staff” access summary instead. Keep gym selection, password reset/change, active/disabled controls, and Super Admin account creation.

- [ ] **Step 6: Simplify the normal staff home to the approved daily tools.**

Keep Memberships, Reception / Barcode, Sundries Order, Bar List. Super Admin management surfaces remain separate.

- [ ] **Step 7: Run tests and commit.**

```bash
git add lib/systemPermissions.ts app/api/admin/system-users/route.ts components/admin/SystemUsersAdmin.tsx components/staff/StaffLoginPage.tsx tests/system-user-permissions.test.mjs tests/gym-staff-role.test.mjs
git commit -m "feat: enforce fixed gym staff role"
```

---

### Task 3: Introduce card-credential lifecycle and retire generated BGM allocation

**Files:**
- Create: `lib/memberCardCredentialCore.ts`
- Create: `tests/member-card-credential-core.test.mjs`
- Create: `supabase/migrations/<generated>_member_card_credentials_and_photos.sql`
- Modify: `supabase/migrations/20260910_100000_membership_enrollment_activation.sql` only if required for source-history consistency; otherwise supersede behavior in the new follow-up migration.
- Test: `tests/membership-enrollment-schema.test.mjs`
- Test: `tests/member-card-schema.test.mjs`

**Interfaces:**
- Produces conceptual card states `reserved | active | retired` and decision helpers such as:

```ts
export type CardCredentialStatus = "reserved" | "active" | "retired";

export function normalizeBarcodePayload(raw: string): string;
export function decideRenewalCardAction(currentBarcode: string | null, scannedBarcode: string): "keep" | "replace";
```

`normalizeBarcodePayload` may trim scanner terminator whitespace but must not numeric-coerce, uppercase, pad, prefix, or otherwise change the actual credential characters.

- [ ] **Step 1: Write RED unit tests for exact payload preservation and renewal decisions.**

Examples:

```ts
assert.equal(normalizeBarcodePayload("0012345\n"), "0012345");
assert.equal(decideRenewalCardAction("0012345", "0012345"), "keep");
assert.equal(decideRenewalCardAction("0012345", "0099999"), "replace");
```

- [ ] **Step 2: Run RED and implement minimal pure helpers.**

- [ ] **Step 3: Write RED schema contract tests.**

Require a card-credential table linked to `bgm_members.id`, optional pending application participant reference, unique barcode value, status constraint, retired timestamp/reason, and indexes for barcode/member/status lookup. Require generated BGM number default/allocation to be disabled for new operational members.

- [ ] **Step 4: Create the Supabase migration using the current Supabase CLI/MCP migration workflow.**

The migration must:
- create the credential lifecycle table;
- preserve existing internal member UUIDs;
- remove the automatic `bgm_next_member_number()` default from `bgm_members.member_number` or otherwise prevent it from being used for new operational identity;
- retain `member_number` temporarily only as a compatibility mirror of the active card barcode where existing code still requires it;
- add any necessary application-participant card reservation linkage;
- add photo provenance fields or a focused provenance table;
- keep exposed-schema tables protected with RLS/revoked direct browser access where appropriate.

- [ ] **Step 5: Verify schema only in Development Supabase.**

Check constraints, uniqueness, RLS, function grants, and that no Production project is touched.

- [ ] **Step 6: Run focused tests/full CI and commit.**

```bash
git add lib/memberCardCredentialCore.ts tests/member-card-credential-core.test.mjs tests/member-card-schema.test.mjs tests/membership-enrollment-schema.test.mjs supabase/migrations
git commit -m "feat: add preprinted card credential lifecycle"
```

---

### Task 4: Add private official-photo capture and secure delivery

**Files:**
- Create: `app/api/system/members/photo/route.ts`
- Create: secure member-photo delivery route under `app/api/system/members/photo/...`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `app/api/system/barcode/scan/route.ts`
- Test: `tests/member-photo-contract.test.mjs`
- Test: `tests/barcode-reception-photo.test.mjs`

**Interfaces:**
- Photo upload endpoint accepts authenticated staff context plus application participant or permanent member identity and returns private object-path metadata, not a public URL.
- Secure display route returns/redirects to a short-lived signed representation only after system authorization.

- [ ] **Step 1: Write RED tests for privacy and mandatory photo state.**

Assert new application activation cannot proceed without participant photo(s); raw object paths are not treated as public browser URLs; barcode response exposes a secure display URL/reference and `photoRequired` state.

- [ ] **Step 2: Create/verify the private `bgm-member-photos` Storage bucket in Development and the required server-only/RLS access model.**

Use current Supabase Storage docs. Never mark the bucket public.

- [ ] **Step 3: Implement tablet camera capture UI.**

Use browser media capture suitable for the front-desk tablet, show preview with `Use Photo` and `Retake`, and compress/normalize to a reasonable web image format before upload when practical.

- [ ] **Step 4: Store pre-activation photos against application/participant identity.**

After permanent member creation/activation, move/copy or logically re-home the current official photo under an immutable member UUID-based path such as `<member-uuid>/official/<timestamp>.webp` and update `official_photo_path` atomically/safely.

- [ ] **Step 5: Implement migrated-member `PHOTO REQUIRED` gating.**

Active member + no photo: no canonical barcode check-in yet; capture photo; revalidate membership; create exactly one canonical check-in if still active.

- [ ] **Step 6: Render the real official photo on reception.**

Use the secure URL/reference with placeholder only for genuinely missing/unavailable photos.

- [ ] **Step 7: Run focused tests/full CI and commit.**

```bash
git add app/api/system/members/photo components/staff/MembershipEnrollmentPage.tsx components/staff/BarcodeReceptionPage.tsx app/api/system/barcode/scan/route.ts tests/member-photo-contract.test.mjs tests/barcode-reception-photo.test.mjs
git commit -m "feat: add private official member photo workflow"
```

---

### Task 5: Add new-membership main-screen card assignment and notification

**Files:**
- Create: `app/api/system/members/card/assign/route.ts`
- Modify: `components/staff/StaffLoginPage.tsx` or the existing staff notification/pending-action surface
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: existing activation RPC through the new follow-up migration
- Test: `tests/member-card-assignment-contract.test.mjs`
- Test: `tests/membership-enrollment-contract.test.mjs`

**Interfaces:**
- `assign` action reserves an unused card barcode to a pending application participant.
- Activation requires all new participants to have photo + reserved card.

- [ ] **Step 1: Write RED tests for `NEW MEMBERSHIP READY — SCAN CARD`.**

Require pending new applications to appear to the authenticated gym account's main screen with applicant name/photo context and unresolved card status.

- [ ] **Step 2: Write RED API tests for card reservation.**

Reject blank barcode, active/reserved/retired conflicting barcode, wrong gym/application access, or attempting to assign one barcode to two Couples participants.

- [ ] **Step 3: Implement card reservation API and main-screen scanner state.**

Scanner input must preserve exact decoded payload and show applicant name/photo + scanned value before confirmation.

- [ ] **Step 4: Allow pre-activation correction.**

A wrong unused card may be released/replaced while still merely reserved. An issued/active card may not be silently reassigned.

- [ ] **Step 5: Update activation to promote reserved card(s) atomically.**

Activation creates/activates member identity/membership and turns each reservation into the active credential for the corresponding permanent member UUID. Mirror current barcode into compatibility field only if still needed by current code.

- [ ] **Step 6: Run tests/full CI and commit.**

```bash
git add app/api/system/members/card/assign/route.ts components/staff/StaffLoginPage.tsx components/staff/MembershipEnrollmentPage.tsx app/api/system/members/enroll/route.ts tests/member-card-assignment-contract.test.mjs tests/membership-enrollment-contract.test.mjs supabase/migrations
git commit -m "feat: assign preprinted cards from reception"
```

---

### Task 6: Make renewal require a card scan and safely replace cards when the scanned card differs

**Files:**
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: `app/api/system/members/card/assign/route.ts`
- Modify: activation RPC/migration as required
- Test: `tests/membership-renewal-card-contract.test.mjs`

**Interfaces:**
- Renewal stores both the current active card and the staff-scanned renewal card decision.
- Same payload => `keep`.
- Different unused payload => `replace_on_activation`.

- [ ] **Step 1: Write RED tests requiring a renewal card scan before activation.**

Test same-card and new-card cases, including barcode entered from the member app because the phone barcode is the same credential payload.

- [ ] **Step 2: Implement renewal UI scanner step.**

After member identity confirmation, show current photo/current barcode and require `SCAN MEMBERSHIP CARD`. Do not allow renewal activation until the scan is validated.

- [ ] **Step 3: Implement same-card validation.**

If scanned barcode equals current active credential, record verification and leave credential history unchanged.

- [ ] **Step 4: Implement replacement-on-renewal reservation.**

If scanned barcode differs and is unused, reserve it as the proposed replacement. Do not retire the old card until renewal activation commits.

- [ ] **Step 5: Update atomic activation.**

On successful renewal activation with replacement: retire old credential with reason `renewal_replacement`, activate new credential, keep same `bgm_members.id`, photo/history/app identity, and create the new membership period.

If activation fails, old card remains active/known and the replacement does not become active.

- [ ] **Step 6: Run tests/full CI and commit.**

```bash
git add components/staff/MembershipEnrollmentPage.tsx app/api/system/members/enroll/route.ts app/api/system/members/card/assign/route.ts tests/membership-renewal-card-contract.test.mjs supabase/migrations
git commit -m "feat: require card verification on renewal"
```

---

### Task 7: Add standalone `Issue New Card` for lost/stolen/damaged cards

**Files:**
- Create: `app/api/system/members/card/replace/route.ts`
- Create or modify staff UI component for member/card actions
- Modify: `components/staff/StaffLoginPage.tsx` and/or reception member actions
- Test: `tests/member-card-replacement-contract.test.mjs`

**Interfaces:**
- Request: member UUID, exact new barcode payload, replacement reason (`lost | stolen | damaged | other`), authenticated system user/gym context.
- Result: same member UUID, old credential retired, new credential active, unchanged membership dates/status.

- [ ] **Step 1: Write RED tests proving replacement does not renew membership.**

Assert expiry/start/status values are unchanged; only credential records/current compatibility mirror change.

- [ ] **Step 2: Implement `Issue New Card` UI.**

Staff searches/scans the member, sees name/photo/current card/status, chooses reason, scans a new preprinted card, verifies assignment, confirms replacement.

- [ ] **Step 3: Implement replacement transaction.**

Lock current active credential and new barcode, reject any conflicting/retired issued barcode, retire old and activate new in one database transaction, and audit the replacement reason/system account.

- [ ] **Step 4: Verify retired card immediately denies reception access.**

No canonical check-in may be created from the retired barcode.

- [ ] **Step 5: Run tests/full CI and commit.**

```bash
git add app/api/system/members/card/replace/route.ts components/staff tests/member-card-replacement-contract.test.mjs supabase/migrations
git commit -m "feat: add staff issue-new-card workflow"
```

---

### Task 8: Resolve reception scans through the card credential lifecycle

**Files:**
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Test: `tests/barcode-access-contract.test.mjs`
- Test: `tests/barcode-reception-photo.test.mjs`

**Interfaces:**
- Scan lookup becomes `barcode_value -> card credential -> member UUID -> membership state -> photo gate -> access decision`.

- [ ] **Step 1: Write RED tests for active, retired, expired, inactive, photo-required and unknown cards.**

- [ ] **Step 2: Replace member_number-only lookup with credential lookup.**

Active card resolves member. Retired card resolves enough history for `CARD REPLACED` but never grants. Unknown barcode remains unknown.

- [ ] **Step 3: Preserve exactly-one canonical check-in behavior.**

Active + photo available => one `source='barcode'` check-in. Active + missing photo => zero until photo capture/revalidation, then exactly one. Expired/inactive/retired/unknown => zero.

- [ ] **Step 4: Update reception UI.**

Show large real photo and green/red states, including `CARD REPLACED` and `PHOTO REQUIRED`.

- [ ] **Step 5: Run tests/full CI and commit.**

```bash
git add app/api/system/barcode/scan/route.ts components/staff/BarcodeReceptionPage.tsx tests/barcode-access-contract.test.mjs tests/barcode-reception-photo.test.mjs
git commit -m "feat: resolve reception access through card credentials"
```

---

### Task 9: Make the member-app virtual card mirror the active physical barcode

**Files:**
- Create: `app/api/member/card/route.ts`
- Modify: the existing member-card component/page that currently renders the launch barcode
- Modify: member-side typed data model as needed
- Test: `tests/member-virtual-card-contract.test.mjs`

**Interfaces:**
- Authenticated member-side endpoint derives member UUID from signed member session and returns current membership state + active card barcode.

Example response shape:

```ts
{
  memberNumber: string | null;
  barcodeValue: string | null;
  membershipStatus: "active" | "expired" | "inactive";
  expiryDate: string | null;
}
```

`memberNumber` may be the same display value as `barcodeValue` during compatibility transition.

- [ ] **Step 1: Write RED tests that virtual barcode equals exact active physical-card payload.**

Include leading-zero payload and replacement update. Assert no fabricated barcode when no card is linked.

- [ ] **Step 2: Implement authenticated `/api/member/card`.**

Do not accept arbitrary `memberId` from the client as authorization. Derive the member from the signed member session.

- [ ] **Step 3: Switch virtual membership card to server barcode source.**

Render Code 128 using the exact current active payload. Show `CARD NOT LINKED — ASK RECEPTION` when no active card exists.

- [ ] **Step 4: Ensure replacement is reflected without a new member identity/login.**

After normal refresh/re-fetch, the app displays the replacement barcode because the server resolves the same member UUID to the new active credential.

- [ ] **Step 5: Run tests/full CI and commit.**

```bash
git add app/api/member/card/route.ts components app tests/member-virtual-card-contract.test.mjs
git commit -m "feat: mirror active physical barcode in member app"
```

---

### Task 10: Revise migration/import/export to use optional `CardBarcode`

**Files:**
- Modify: existing member XLSX/CSV import core and API routes
- Modify: existing export core/API routes
- Modify: import-apply database RPC/migration if it still allocates BGM numbers
- Test: existing migration/import/export contract tests plus new `tests/member-card-migration-contract.test.mjs`

**Interfaces:**
- Revised 16-column BGM exchange header begins with `CardBarcode` instead of `MembershipNumber`.
- `CardBarcode` may be blank.

- [ ] **Step 1: Write RED tests for exact revised 16-column contract.**

Require text preservation including leading zeroes; blank barcode does not fabricate a credential.

- [ ] **Step 2: Remove generated-number allocation from import apply.**

New legacy person rows receive permanent internal UUIDs only. Card credential is created only when a deterministic card barcode is supplied or later scanned at reception.

- [ ] **Step 3: Preserve conservative matching rules.**

Existing legacy linkage remains primary for blank-barcode records. A provided barcode conflicting with another member is `Conflict / Needs review`, never reassigned.

- [ ] **Step 4: Add migration reporting counts.**

Report safely linked cards, blank/unlinked cards, photo-linked/photo-missing/manual-review counts where source material supports them.

- [ ] **Step 5: Run round-trip XLSX/CSV tests and full CI, then commit.**

```bash
git add lib app supabase/migrations tests
git commit -m "feat: migrate members with optional preprinted card barcodes"
```

---

### Task 11: Preview verification and safety gate

**Files:**
- No Production changes.
- Tests/fixtures may be added only if needed to capture verified scanner behavior.

**Interfaces:**
- Produces a verified development-branch build and Preview-ready behavior; does not merge.

- [ ] **Step 1: Run the complete automated suite, typecheck and production build command used by existing CI.**

All tests must pass. Capture the exact run/commit evidence.

- [ ] **Step 2: Verify Development Supabase.**

Check card uniqueness, active/retired transitions, RLS/private photo bucket, activation transaction, and that old generated allocator is no longer used by new workflows.

- [ ] **Step 3: Controlled manual card tests.**

Use representative preprinted cards to test:
- new member card assignment;
- renewal with same card;
- renewal with replacement card;
- standalone Issue New Card;
- old retired card denied;
- active card granted;
- expired card identified but denied;
- missing-photo gating.

- [ ] **Step 4: Phone-screen barcode compatibility test.**

Test at least one real member-app virtual barcode on a representative phone against the actual reception barcode reader. Confirm scanner decodes the exact same payload as the physical card.

- [ ] **Step 5: Verify branch/main/Production isolation.**

Confirm `phase-2-operations-nfc-redesign` contains all work, `main` has not moved because of this implementation, and Production database/deployment was not changed.

- [ ] **Step 6: Stop for explicit Preview/user approval.**

Do not merge or deploy Production automatically.
