# Preprinted Card, Photo, Renewal & Virtual Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generated BGM membership numbers with scanned preprinted card barcodes while preserving permanent member identity, mandatory official-photo capture, renewal card verification, safe card replacement, reception access, and a member-app virtual barcode that exactly mirrors the current physical card.

**Architecture:** `bgm_members.id` remains the immutable person identity. `bgm_member_card_credentials` owns opaque barcode values and their `reserved -> active -> retired` lifecycle. New membership and renewal continue through application-first/payment activation; every renewal requires a card scan, and a different unused barcode becomes a replacement only when activation commits. Official photos stay private in Supabase Storage. The member app reads the active card from an authenticated member API, never from stale localStorage.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind, Supabase Postgres + private Storage, existing system/member session auth, Code 128 rendering, GitHub Actions.

**Specs:**
- `docs/superpowers/specs/2026-09-10-gym-staff-member-photo-lifecycle-design.md`
- `docs/superpowers/specs/2026-09-09-membership-number-xlsx-barcode-transition-design.md`
- `docs/superpowers/specs/2026-09-10-membership-enrollment-activation-design.md`

## Global Constraints

- Work only on `phase-2-operations-nfc-redesign`; never commit to `main`.
- Production Supabase and Production Vercel stay untouched until explicit Preview approval.
- Development Supabase project is `jsuolemirhivqhjbjetv`.
- Permanent person identity is `bgm_members.id`; barcode is a replaceable credential.
- Preserve scanned barcode payload as text, including leading zeroes and valid letters. Strip only scanner terminator whitespace.
- New membership requires details, photo, main-screen card scan, Application Staff Name, Activation Staff Name, and `PAYMENT RECEIVED — ACTIVATE`.
- Every renewal requires a card scan. Same active barcode = keep card. Different unused barcode = replace on successful renewal activation; old card becomes permanently retired.
- `Issue New Card` is a separate staff action for lost/stolen/damaged cards and must never extend membership dates.
- Member app virtual card renders the exact active physical-card payload; replacement updates the app barcode automatically.
- Official member photos stay private and are shown to authenticated staff for identity verification.
- Normal Gym Staff uses one fixed operational role; Super Admin remains unrestricted.
- Granted barcode access creates exactly one canonical check-in with `source='barcode'`; denied/retired/unknown/photo-incomplete access does not.
- Retired issued barcodes are never reassigned.

---

## File Map

### Existing files
- `lib/systemPermissions.ts` — canonical fixed Gym Staff permission bundle.
- `lib/systemUserCore.ts` — normalize server-side Gym Staff role behavior.
- `app/api/admin/system-users/route.ts` — enforce fixed Gym Staff permissions.
- `components/admin/SystemUsersAdmin.tsx` — remove gym permission checkbox editor.
- `components/staff/StaffLoginPage.tsx` — daily staff tools and pending membership/card actions.
- `components/staff/MembershipEnrollmentPage.tsx` — tablet/application flow, renewal card scan, photo state.
- `components/staff/BarcodeReceptionPage.tsx` — reception scan, photo, active/expired/replaced/photo-required states.
- `app/api/system/members/enroll/route.ts` — application creation and activation request.
- `app/api/system/members/search/route.ts` — safe renewal/member lookup.
- `app/api/system/barcode/scan/route.ts` — access decision and check-in.
- `components/member/MemberCard.tsx` — virtual membership card.
- `components/member/MemberBarcode.tsx` — Code 128 renderer.
- `lib/memberSession.ts` — current client member cache; no longer barcode source of truth.
- `lib/memberServerSession.ts` — authenticated member identity for member APIs.
- `lib/memberExchangeCore.ts`, `lib/memberExchangeCsv.ts`, `lib/memberExchangeWorkbook.ts`, `lib/memberImportMatchCore.ts`, `lib/memberImportServer.ts` — transition data pipeline.
- `app/api/admin/members/import/preview/route.ts`, `app/api/admin/members/import/apply/route.ts`, `app/api/admin/members/export/route.ts` — transition APIs.
- `supabase/migrations/20260909_140000_membership_identity_exchange.sql` — existing generated-number schema, superseded by follow-up migrations.
- `supabase/migrations/20260909_143000_apply_member_import_batch.sql` — existing import apply behavior, superseded where it allocates numbers.
- `supabase/migrations/20260910_100000_membership_enrollment_activation.sql` — existing activation transaction, superseded for card-based activation.

### New files
- `lib/memberCardCredentialCore.ts`
- `app/api/system/members/card/assign/route.ts`
- `app/api/system/members/card/replace/route.ts`
- `app/api/system/members/photo/route.ts`
- `app/api/system/members/photo/[memberId]/route.ts`
- `app/api/member/card/route.ts`
- `app/staff/members/enroll/page.tsx`
- `supabase/migrations/20260910_111000_member_card_credentials.sql`
- `supabase/migrations/20260910_112000_member_photo_provenance.sql`
- `supabase/migrations/20260910_113000_membership_card_activation.sql`
- `supabase/migrations/20260910_114000_card_replacement.sql`
- `supabase/migrations/20260910_115000_member_import_card_barcode.sql`
- `tests/gym-staff-role.test.mjs`
- `tests/member-card-credential-core.test.mjs`
- `tests/member-card-schema.test.mjs`
- `tests/member-photo-contract.test.mjs`
- `tests/member-card-assignment-contract.test.mjs`
- `tests/membership-renewal-card-contract.test.mjs`
- `tests/member-card-replacement-contract.test.mjs`
- `tests/member-virtual-card-contract.test.mjs`
- `tests/member-card-migration-contract.test.mjs`

---

### Task 1: Finish the existing membership enrollment GREEN cycle

**Files:**
- Create: `app/staff/members/enroll/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `app/api/system/members/search/route.ts`
- Test: `tests/membership-enrollment-ui-contract.test.mjs`
- Test: `tests/membership-enrollment-search-contract.test.mjs`

**Interfaces:**
- Produces `/staff/members/enroll` and renewal candidates with `firstName`, `lastName`, `fullName`, member UUID, status/expiry and current card display field.

- [ ] **Step 1: Extend the existing UI/search tests to require the route, Members link and explicit first/last names.**
- [ ] **Step 2: Run `node --test tests/membership-enrollment-ui-contract.test.mjs tests/membership-enrollment-search-contract.test.mjs` and verify RED only for the new assertions.**
- [ ] **Step 3: Create `app/staff/members/enroll/page.tsx`:**

```tsx
import MembershipEnrollmentPage from "@/components/staff/MembershipEnrollmentPage";

export default function StaffMembershipEnrollmentRoute() {
  return <MembershipEnrollmentPage />;
}
```

- [ ] **Step 4: Link the Members feature in `StaffLoginPage.tsx` to `/staff/members/enroll`.**
- [ ] **Step 5: Select/return `first_name` and `last_name` explicitly in member search; keep `fullName` for display compatibility.**
- [ ] **Step 6: Re-run focused tests, then the repository's full test/typecheck/build commands.**
- [ ] **Step 7: Commit `feat: finish staff membership enrollment entry point`.**

---

### Task 2: Enforce the fixed Gym Staff role

**Files:**
- Modify: `lib/systemPermissions.ts`
- Modify: `lib/systemUserCore.ts`
- Modify: `app/api/admin/system-users/route.ts`
- Modify: `components/admin/SystemUsersAdmin.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `tests/system-permissions.test.mjs`
- Modify: `tests/system-user-core.test.mjs`
- Create: `tests/gym-staff-role.test.mjs`

**Interfaces:**
```ts
export const GYM_STAFF_PERMISSIONS: readonly SystemPermissionKey[];
```

The bundle must provide only what Memberships, Reception/Barcode, official-photo view/capture, Sundries submit and Bar submit need. It must exclude analytics, user management, notification settings, imports/exports, global order history/manage, announcements management and gym management.

- [ ] **Step 1: Write failing role tests proving the allowed and excluded capabilities.**
- [ ] **Step 2: Run `node --test tests/system-permissions.test.mjs tests/system-user-core.test.mjs tests/gym-staff-role.test.mjs` and verify RED.**
- [ ] **Step 3: Add `GYM_STAFF_PERMISSIONS` and make non-Super-Admin gym-user create/update always use it, ignoring arbitrary client permission arrays.**
- [ ] **Step 4: Remove the permission checkbox grid for Gym Staff from `SystemUsersAdmin.tsx`; show a read-only role summary.**
- [ ] **Step 5: Keep normal staff home limited to Memberships, Reception / Barcode, Sundries Order and Bar List.**
- [ ] **Step 6: Re-run focused/full CI and commit `feat: enforce fixed gym staff role`.**

---

### Task 3: Add the card credential lifecycle and retire generated-number allocation

**Files:**
- Create: `lib/memberCardCredentialCore.ts`
- Create: `tests/member-card-credential-core.test.mjs`
- Create: `tests/member-card-schema.test.mjs`
- Modify: `tests/member-number-core.test.mjs`
- Modify: `tests/member-number-schema.test.mjs`
- Create: `supabase/migrations/20260910_111000_member_card_credentials.sql`

**Interfaces:**
```ts
export type CardCredentialStatus = "reserved" | "active" | "retired";
export function normalizeBarcodePayload(raw: string): string;
export function decideRenewalCardAction(
  currentBarcode: string | null,
  scannedBarcode: string
): "keep" | "replace";
```

`bgm_member_card_credentials` fields: `id`, `barcode_value`, `member_id`, `application_member_id`, `status`, `reserved_at`, `activated_at`, `retired_at`, `retired_reason`, `created_by_system_user_id`, `updated_at`.

- [ ] **Step 1: Write RED core tests, including `normalizeBarcodePayload("0012345\n") === "0012345"`, same-card => `keep`, different-card => `replace`.**
- [ ] **Step 2: Implement the minimal pure helpers and verify GREEN.**
- [ ] **Step 3: Write RED schema tests requiring globally unique `barcode_value`, member/application linkage, state constraint and indexes.**
- [ ] **Step 4: Add `20260910_111000_member_card_credentials.sql` to create the card table and remove the `bgm_next_member_number()` default from `bgm_members.member_number`. Keep `member_number` temporarily nullable as a compatibility mirror of the current active card.**
- [ ] **Step 5: Revoke direct `anon`/`authenticated` table access and enable RLS as defense in depth. Do not expose privileged card mutation functions to browser roles.**
- [ ] **Step 6: Apply/verify this migration only in Development `jsuolemirhivqhjbjetv`; verify generated BGM allocation is no longer the default for new operational members.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: add preprinted card credential lifecycle`.**

---

### Task 4: Add private official-photo capture, provenance and secure staff delivery

**Files:**
- Create: `supabase/migrations/20260910_112000_member_photo_provenance.sql`
- Create: `app/api/system/members/photo/route.ts`
- Create: `app/api/system/members/photo/[memberId]/route.ts`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Create: `tests/member-photo-contract.test.mjs`
- Modify: `tests/barcode-reception-contract.test.mjs`

**Interfaces:**
- POST `/api/system/members/photo` accepts authenticated staff context plus exactly one target: pending `applicationMemberId` or permanent `memberId`, plus captured image form data.
- GET `/api/system/members/photo/[memberId]` requires authenticated system permission and serves/redirects through a short-lived signed private-storage URL.

- [ ] **Step 1: Write RED tests for mandatory new-member photo, private paths, authorized delivery and `photoRequired`.**
- [ ] **Step 2: In Development, create/verify private bucket `bgm-member-photos`; never mark it public.**
- [ ] **Step 3: Add photo provenance fields/table with source values `legacy_import | new_membership | renewal | reception_capture`, timestamp and system/gym context.**
- [ ] **Step 4: Add tablet camera capture in `MembershipEnrollmentPage.tsx` using browser camera input/media capture, with visible preview and exact actions `Use Photo` / `Retake`. Couples require one accepted photo per participant.**
- [ ] **Step 5: Upload pending photos under application-participant paths; after activation, write the current official photo under `<member-uuid>/official/<timestamp>.webp` and update `official_photo_path`.**
- [ ] **Step 6: Implement secure photo delivery and change `BarcodeReceptionPage.tsx` from the initial placeholder to the actual official photo whenever available.**
- [ ] **Step 7: Active migrated member with no photo must return `PHOTO REQUIRED`, create zero normal check-ins, capture photo, revalidate membership, then create exactly one granted check-in.**
- [ ] **Step 8: Run focused/full CI and commit `feat: add private official member photo workflow`.**

---

### Task 5: Add main-screen card assignment for new memberships

**Files:**
- Create: `app/api/system/members/card/assign/route.ts`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/enroll/route.ts`
- Create: `supabase/migrations/20260910_113000_membership_card_activation.sql`
- Create: `tests/member-card-assignment-contract.test.mjs`
- Modify: `tests/membership-enrollment-contract.test.mjs`
- Modify: `tests/membership-enrollment-schema.test.mjs`

**Interfaces:**
- Staff home queries/receives pending membership applications for its own gym and shows `NEW MEMBERSHIP READY — SCAN CARD`.
- POST card assign reserves an exact unused barcode to one application participant.
- Activation requires accepted photo + reserved card for every new participant.

- [ ] **Step 1: Write RED tests for pending main-screen action and card reservation uniqueness.**
- [ ] **Step 2: Add pending application/card status to `StaffLoginPage.tsx`; opening it shows applicant name + secure photo and focuses scanner input.**
- [ ] **Step 3: Implement card reservation endpoint. Reject blank, active, reserved or retired issued barcodes and cross-gym unauthorized application access.**
- [ ] **Step 4: Allow correction of a merely reserved wrong card before activation; never silently move an active/retired issued card.**
- [ ] **Step 5: Replace `bgm_activate_membership_application` in the new migration so new activation creates the member/membership and promotes each reserved card to active in one transaction. Mirror active barcode into nullable `bgm_members.member_number` only for compatibility.**
- [ ] **Step 6: Couples activation requires two photos + two distinct reserved cards mapped to the correct participant.**
- [ ] **Step 7: Verify Development transaction behavior, run focused/full CI and commit `feat: assign preprinted cards from reception`.**

---

### Task 6: Require a card scan on every renewal

**Files:**
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/search/route.ts`
- Modify: `app/api/system/members/card/assign/route.ts`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: `supabase/migrations/20260910_113000_membership_card_activation.sql` before it is applied, or create the next migration if Task 5 has already been applied in Development.
- Create: `tests/membership-renewal-card-contract.test.mjs`

**Interfaces:**
- Renewal stores verified `scannedBarcode` and decision `keep | replace` before activation.

- [ ] **Step 1: Write RED tests proving renewal cannot activate without a validated card scan.**
- [ ] **Step 2: In renewal UI, after member confirmation show photo, current active barcode and `SCAN MEMBERSHIP CARD`; accept either the physical card or member-app barcode because both decode to the same payload.**
- [ ] **Step 3: Same scanned active barcode records verification only and leaves credential history unchanged.**
- [ ] **Step 4: Different unused barcode becomes a reserved `replace_on_activation` credential. The old card remains current until payment activation succeeds.**
- [ ] **Step 5: On successful renewal activation with replacement, retire old card with reason `renewal_replacement`, activate the new card, keep the same member UUID/photo/history, and create the new membership period atomically.**
- [ ] **Step 6: On activation failure, leave old card unchanged and new card unactivated.**
- [ ] **Step 7: Run focused/full CI and commit `feat: require card verification on renewal`.**

---

### Task 7: Add standalone `Issue New Card`

**Files:**
- Create: `app/api/system/members/card/replace/route.ts`
- Create: `supabase/migrations/20260910_114000_card_replacement.sql`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Create: `tests/member-card-replacement-contract.test.mjs`

**Interfaces:**
- POST replacement request includes `memberId`, `barcode`, `reason: "lost" | "stolen" | "damaged" | "other"`.
- Result keeps membership dates/status unchanged and switches only the active credential for the same member UUID.

- [ ] **Step 1: Write RED tests proving replacement does not renew/extend membership and retired barcode cannot grant access.**
- [ ] **Step 2: Add visible staff action `Issue New Card` from member/reception actions. Show name, photo, current barcode/status, reason selector and scanner input.**
- [ ] **Step 3: Implement a transaction that locks current/new credentials, rejects any barcode ever issued/retired in conflict, retires old card and activates new card atomically, then audits reason/system user/gym.**
- [ ] **Step 4: Mirror the new active card into compatibility `member_number`; do not alter member UUID, membership start, expiry or status.**
- [ ] **Step 5: Run focused/full CI and commit `feat: add staff issue-new-card workflow`.**

---

### Task 8: Route reception access through card credentials

**Files:**
- Modify: `lib/barcodeAccessCore.ts`
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `tests/barcode-access-core.test.mjs`
- Modify: `tests/barcode-reception-contract.test.mjs`

**Interfaces:**
`scanned payload -> card credential -> member UUID -> current membership -> photo gate -> access result -> check-in`

- [ ] **Step 1: Write RED cases for active, expired, inactive, retired/replaced, unknown and photo-required scans.**
- [ ] **Step 2: Resolve barcode against `bgm_member_card_credentials`, not directly against `bgm_members.member_number`.**
- [ ] **Step 3: Active + photo => green `ACCESS GRANTED`, secure photo, exactly one canonical check-in.**
- [ ] **Step 4: Expired/inactive => red denied result with member photo where available, zero normal check-ins.**
- [ ] **Step 5: Retired => red `CARD REPLACED`, zero check-ins. Unknown => `MEMBER/CARD NOT FOUND`, zero check-ins.**
- [ ] **Step 6: Re-run focused/full CI and commit `feat: resolve reception access through card credentials`.**

---

### Task 9: Make the member-app virtual card mirror the active physical card

**Files:**
- Create: `app/api/member/card/route.ts`
- Modify: `components/member/MemberCard.tsx`
- Modify: `components/member/MemberBarcode.tsx`
- Modify: `lib/memberServerSession.ts` only if a reusable current-member resolver is needed.
- Modify: `tests/member-barcode-contract.test.mjs`
- Create: `tests/member-virtual-card-contract.test.mjs`

**Interfaces:**
GET `/api/member/card` derives member UUID from signed member session and returns:

```ts
{
  barcodeValue: string | null;
  membershipStatus: "active" | "expired" | "inactive";
  expiryDate: string | null;
}
```

- [ ] **Step 1: Write RED tests for exact payload, leading zeroes, replacement update and no-card state.**
- [ ] **Step 2: Implement authenticated `/api/member/card`; reject unauthenticated requests and never authorize from a client-supplied member ID.**
- [ ] **Step 3: Change `MemberCard.tsx` so barcode/status/expiry come from this authenticated endpoint. `getSavedMember()` may remain for non-security-critical display fallback such as name, but never for barcode source of truth.**
- [ ] **Step 4: Pass exact `barcodeValue` to `MemberBarcode.tsx`; render Code 128 without changing the payload.**
- [ ] **Step 5: When no active card exists show `CARD NOT LINKED — ASK RECEPTION`; never fabricate `BGMxxxxxxx`.**
- [ ] **Step 6: Verify that same-card renewal leaves the app barcode unchanged and card replacement changes it after normal re-fetch/refresh without a new login identity.**
- [ ] **Step 7: Run focused/full CI and commit `feat: mirror active physical barcode in member app`.**

---

### Task 10: Revise migration/import/export around optional `CardBarcode`

**Files:**
- Modify: `lib/memberExchangeCore.ts`
- Modify: `lib/memberExchangeCsv.ts`
- Modify: `lib/memberExchangeWorkbook.ts`
- Modify: `lib/memberImportMatchCore.ts`
- Modify: `lib/memberImportServer.ts`
- Modify: `app/api/admin/members/import/preview/route.ts`
- Modify: `app/api/admin/members/import/apply/route.ts`
- Modify: `app/api/admin/members/export/route.ts`
- Create: `supabase/migrations/20260910_115000_member_import_card_barcode.sql`
- Modify: `tests/member-exchange-core.test.mjs`
- Modify: `tests/member-exchange-csv.test.mjs`
- Modify: `tests/member-exchange-workbook.test.mjs`
- Modify: `tests/member-import-match-core.test.mjs`
- Modify: `tests/member-import-apply-schema.test.mjs`
- Modify: `tests/member-export-contract.test.mjs`
- Create: `tests/member-card-migration-contract.test.mjs`

**Interfaces:**
Revised BGM 16-column header begins with exact text `CardBarcode`; original 15-column legacy layout remains accepted only by the controlled legacy path.

- [ ] **Step 1: Write RED tests requiring `CardBarcode` as text, preserving leading zeroes and allowing blank.**
- [ ] **Step 2: Replace `MembershipNumber` semantics in exchange parse/export with optional `CardBarcode`; do not numeric-coerce it.**
- [ ] **Step 3: Remove generated BGM number allocation from `bgm_apply_member_import_batch` via the new migration. New imported people get internal UUIDs; only deterministic supplied card barcodes create/link credentials.**
- [ ] **Step 4: Preserve conservative matching: blank card uses legacy linkage; conflicting card is `Conflict / Needs review`; omitted rows never delete members.**
- [ ] **Step 5: Add/report counts for safely linked cards, unlinked cards, safely linked photos, missing photos and ambiguous/manual-review records when the source provides those assets.**
- [ ] **Step 6: Run XLSX/CSV round-trip tests, import safety tests and full CI. Commit `feat: migrate members with optional preprinted card barcodes`.**

---

### Task 11: Preview verification and Production safety gate

**Files:** no Production mutation.

- [ ] **Step 1: Run the complete automated test suite, TypeScript typecheck and production build used by CI; record exact commit/run evidence.**
- [ ] **Step 2: Run Supabase verification/advisors on Development after all migrations. Confirm card uniqueness, active/retired transitions, RLS, private photo bucket, activation/renewal/replacement transactions and retired generated allocator behavior.**
- [ ] **Step 3: Manually test representative preprinted cards: new assignment, renewal same card, renewal new card, standalone `Issue New Card`, old retired card denial, active grant, expired denial and missing-photo gate.**
- [ ] **Step 4: Test a real member-app Code 128 barcode on at least one representative phone with the actual reception scanner and verify decoded payload equals the physical card payload exactly.**
- [ ] **Step 5: Re-fetch `phase-2-operations-nfc-redesign` and `main`; confirm implementation stayed on the branch and Production database/deployment remained untouched.**
- [ ] **Step 6: Stop for explicit user Preview approval. Do not merge or deploy Production automatically.**
