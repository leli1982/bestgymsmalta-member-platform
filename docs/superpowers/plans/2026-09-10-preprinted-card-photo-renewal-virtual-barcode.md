# Preprinted Card, Photo, Renewal & Virtual Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generated BGM membership numbers with scanned preprinted card barcodes while preserving permanent member identity, mandatory official-photo capture, renewal card verification, safe card replacement, reception access, and a member-app virtual barcode that exactly mirrors the currently active physical card.

**Architecture:** `bgm_members.id` remains the immutable person identity. A dedicated `bgm_member_card_credentials` table owns exact barcode payloads and their `reserved -> active -> retired` lifecycle. New membership and renewal remain application-first/payment-activation workflows; every renewal requires a card scan, and a different unused barcode becomes a replacement only when activation commits. Official photos remain private in Supabase Storage. The member app derives its active barcode from the signed member session and server-side card record, never from localStorage.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind, Supabase Postgres + private Storage, existing system/member session authentication, JsBarcode Code 128, GitHub Actions.

**Specs:**
- `docs/superpowers/specs/2026-09-10-gym-staff-member-photo-lifecycle-design.md`
- `docs/superpowers/specs/2026-09-09-membership-number-xlsx-barcode-transition-design.md`
- `docs/superpowers/specs/2026-09-10-membership-enrollment-activation-design.md`

## Global Constraints

- Work only on `phase-2-operations-nfc-redesign`; never commit implementation to `main`.
- Production Supabase and Production Vercel stay untouched until explicit Preview approval.
- Development Supabase project is `jsuolemirhivqhjbjetv`.
- Permanent person identity is `bgm_members.id`; a physical-card barcode is a replaceable credential.
- Preserve barcode payloads as text, including leading zeroes and valid letters. Remove scanner terminator whitespace only.
- New membership requires details, official photo, main-screen card scan, Application Staff Name, Activation Staff Name, and `PAYMENT RECEIVED — ACTIVATE`.
- Every renewal requires a validated card scan. Same active barcode means keep the card. A different unused barcode means replace it only when renewal activation commits; the old card then becomes permanently retired.
- `Issue New Card` is a separate staff action for lost/stolen/damaged cards and must not alter membership dates.
- The member app virtual card renders the exact currently active physical-card barcode.
- Official member photos are private and are displayed only through authenticated staff/member workflows.
- Normal Gym Staff uses one fixed operational role; Super Admin remains unrestricted.
- A granted barcode access creates exactly one canonical check-in with `source = 'barcode'`. Expired, inactive, retired, unknown, and photo-required-before-verification cases create no granted check-in.
- Retired issued barcodes are never reassigned.

---

## File Map

### Existing files to modify
- `lib/systemPermissions.ts`
- `lib/systemUserCore.ts`
- `app/api/admin/system-users/route.ts`
- `components/admin/SystemUsersAdmin.tsx`
- `components/staff/StaffLoginPage.tsx`
- `components/staff/MembershipEnrollmentPage.tsx`
- `components/staff/BarcodeReceptionPage.tsx`
- `app/api/system/members/enroll/route.ts`
- `app/api/system/members/search/route.ts`
- `app/api/system/barcode/scan/route.ts`
- `lib/barcodeAccessCore.ts`
- `components/member/MemberCard.tsx`
- `components/member/MemberBarcode.tsx`
- `lib/memberExchangeCore.ts`
- `lib/memberExchangeCsv.ts`
- `lib/memberExchangeWorkbook.ts`
- `lib/memberImportMatchCore.ts`
- `lib/memberImportServer.ts`
- `app/api/admin/members/import/preview/route.ts`
- `app/api/admin/members/import/apply/route.ts`
- `app/api/admin/members/export/route.ts`

### New focused files
- `app/staff/members/enroll/page.tsx`
- `components/staff/OfficialMemberPhotoCapture.tsx`
- `components/staff/PendingMembershipActions.tsx`
- `components/staff/IssueNewCardPanel.tsx`
- `lib/memberCardCredentialCore.ts`
- `app/api/system/members/card/assign/route.ts`
- `app/api/system/members/card/replace/route.ts`
- `app/api/system/members/photo/route.ts`
- `app/api/system/members/photo/[memberId]/route.ts`
- `app/api/member/card/route.ts`
- `supabase/migrations/20260910_111000_member_card_credentials.sql`
- `supabase/migrations/20260910_112000_member_photo_provenance.sql`
- `supabase/migrations/20260910_113000_membership_card_activation.sql`
- `supabase/migrations/20260910_113500_renewal_card_verification.sql`
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

### Task 1: Finish the existing enrollment UI GREEN cycle

**Files:**
- Create: `app/staff/members/enroll/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `app/api/system/members/search/route.ts`
- Test: `tests/membership-enrollment-ui-contract.test.mjs`
- Test: `tests/membership-enrollment-search-contract.test.mjs`

**Interfaces:** Produces `/staff/members/enroll` and renewal candidates containing member UUID, `firstName`, `lastName`, `fullName`, status, expiry, and current compatibility card value.

- [ ] **Step 1: Extend the existing UI/search tests to require the route, Members link, and explicit first/last names.**
- [ ] **Step 2: Run `node --test tests/membership-enrollment-ui-contract.test.mjs tests/membership-enrollment-search-contract.test.mjs` and verify RED only for the added assertions.**
- [ ] **Step 3: Create the route wrapper:**

```tsx
import MembershipEnrollmentPage from "@/components/staff/MembershipEnrollmentPage";

export default function StaffMembershipEnrollmentRoute() {
  return <MembershipEnrollmentPage />;
}
```

- [ ] **Step 4: Link the Members card in `StaffLoginPage.tsx` to `/staff/members/enroll`.**
- [ ] **Step 5: Select and return `first_name` and `last_name` explicitly from `app/api/system/members/search/route.ts`; keep `fullName` for display compatibility.**
- [ ] **Step 6: Re-run the focused tests and the repository's full test/typecheck/build commands.**
- [ ] **Step 7: Commit with `feat: finish staff membership enrollment entry point`.**

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

**Interfaces:** Add these permission keys to `SYSTEM_PERMISSION_KEYS`: `members.photos.capture`, `cards.assign`, `cards.replace`. Export:

```ts
export const GYM_STAFF_PERMISSIONS: readonly SystemPermissionKey[];
```

The fixed bundle contains only the permissions required by Memberships, Reception/Barcode, member photo view/capture, card assignment/replacement, Sundries submit, and Bar submit. It excludes analytics, system-user management, imports/exports, global order history/manage, announcements management, gym management, and offline roster.

- [ ] **Step 1: Write failing tests proving required and excluded permissions and proving gym-account creation ignores arbitrary client permission arrays.**
- [ ] **Step 2: Run `node --test tests/system-permissions.test.mjs tests/system-user-core.test.mjs tests/gym-staff-role.test.mjs` and verify RED.**
- [ ] **Step 3: Add the three new permission keys and `GYM_STAFF_PERMISSIONS` to `lib/systemPermissions.ts`.**
- [ ] **Step 4: Make non-Super-Admin gym-user create/update normalize to the fixed bundle server-side. Super Admin continues to bypass permission checks through `isSuperAdmin`.**
- [ ] **Step 5: Remove the gym permission checkbox grid from `SystemUsersAdmin.tsx`; replace it with a read-only `Gym Staff` role summary.**
- [ ] **Step 6: Keep the normal staff home limited to Memberships, Reception / Barcode, Sundries Order, and Bar List; card actions are reached from Memberships/Reception, not as management clutter.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: enforce fixed gym staff role`.**

---

### Task 3: Add card-credential lifecycle and retire generated BGM allocation

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

`normalizeBarcodePayload()` removes surrounding scanner terminator whitespace but never numeric-coerces, uppercases, pads, prefixes, or otherwise changes credential characters.

`bgm_member_card_credentials` stores `id`, unique `barcode_value`, nullable `member_id`, nullable `application_member_id`, `status`, `reserved_at`, `activated_at`, `retired_at`, `retired_reason`, `created_by_system_user_id`, and `updated_at`.

- [ ] **Step 1: Write RED unit tests:**

```ts
assert.equal(normalizeBarcodePayload("0012345\n"), "0012345");
assert.equal(normalizeBarcodePayload("AbC-007\r\n"), "AbC-007");
assert.equal(decideRenewalCardAction("0012345", "0012345"), "keep");
assert.equal(decideRenewalCardAction("0012345", "0099999"), "replace");
```

- [ ] **Step 2: Run the test and verify RED, then add the minimal pure implementation and verify GREEN.**
- [ ] **Step 3: Write RED schema-contract tests requiring global barcode uniqueness, lifecycle state constraint, member/application linkage, timestamps, retirement reason, and lookup indexes.**
- [ ] **Step 4: Add `20260910_111000_member_card_credentials.sql`. It creates the credential table, drops the automatic `bgm_next_member_number()` default from `bgm_members.member_number`, makes `member_number` nullable if needed, and retains it only as a temporary compatibility mirror of the active card.**
- [ ] **Step 5: Enable RLS and revoke direct `anon`/`authenticated` access to the credential table. Any privileged mutation function is server-only.**
- [ ] **Step 6: Apply/verify only in Development `jsuolemirhivqhjbjetv`; confirm new operational member creation no longer invokes generated BGM allocation.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: add preprinted card credential lifecycle`.**

---

### Task 4: Add private official-photo capture, provenance, and secure delivery

**Files:**
- Create: `components/staff/OfficialMemberPhotoCapture.tsx`
- Create: `app/api/system/members/photo/route.ts`
- Create: `app/api/system/members/photo/[memberId]/route.ts`
- Create: `supabase/migrations/20260910_112000_member_photo_provenance.sql`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Create: `tests/member-photo-contract.test.mjs`
- Modify: `tests/barcode-reception-contract.test.mjs`

**Interfaces:** `OfficialMemberPhotoCapture` receives a target ID/type, opens the tablet camera, shows the captured preview, and exposes `Use Photo` and `Retake`. POST `/api/system/members/photo` accepts authenticated staff plus exactly one target (`applicationMemberId` or permanent `memberId`). GET `/api/system/members/photo/[memberId]` verifies the system session/permission before delivering a short-lived private-storage representation.

- [ ] **Step 1: Write RED tests for mandatory new-member photo, secure photo delivery, `photoRequired`, and rejection of unauthenticated photo access.**
- [ ] **Step 2: In Development create/verify private bucket `bgm-member-photos`; never set it public.**
- [ ] **Step 3: Add `20260910_112000_member_photo_provenance.sql` to record current photo source (`legacy_import`, `new_membership`, `renewal`, `reception_capture`), capture/import time, and system/gym attribution.**
- [ ] **Step 4: Implement `OfficialMemberPhotoCapture.tsx` with browser camera capture, preview, `Use Photo`, and `Retake`; Couples require an accepted photo for each participant.**
- [ ] **Step 5: Store pending application photos in an application-scoped private path. After activation, store the permanent current photo in a UUID-scoped versioned path generated at runtime as `memberUuid + "/official/" + timestamp + ".webp"`.**
- [ ] **Step 6: Implement secure staff delivery; reception uses the secure representation rather than the raw private object path.**
- [ ] **Step 7: Active migrated member with no photo returns `PHOTO REQUIRED` and creates zero granted check-ins. After successful capture, revalidate membership and create exactly one granted check-in.**
- [ ] **Step 8: Re-run focused/full CI and commit `feat: add private official member photo workflow`.**

---

### Task 5: Add main-screen card assignment for new memberships

**Files:**
- Create: `components/staff/PendingMembershipActions.tsx`
- Create: `app/api/system/members/card/assign/route.ts`
- Create: `supabase/migrations/20260910_113000_membership_card_activation.sql`
- Modify: `components/staff/StaffLoginPage.tsx`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/enroll/route.ts`
- Create: `tests/member-card-assignment-contract.test.mjs`
- Modify: `tests/membership-enrollment-contract.test.mjs`
- Modify: `tests/membership-enrollment-schema.test.mjs`

**Interfaces:** `PendingMembershipActions` lists unresolved membership applications for the authenticated gym and renders `NEW MEMBERSHIP READY — SCAN CARD`. POST `/api/system/members/card/assign` reserves an exact unused barcode against one pending application participant. New activation requires an accepted photo and reserved card for every participant.

- [ ] **Step 1: Write RED tests for pending main-screen actions, exact barcode preservation, uniqueness, and per-participant Couples assignment.**
- [ ] **Step 2: Add `PendingMembershipActions.tsx` to the staff main screen. Opening an item shows applicant name + secure photo and focuses barcode scanner input.**
- [ ] **Step 3: Implement card reservation. Reject blank barcodes, barcodes already reserved/active/retired, unauthorized cross-gym applications, and one barcode being assigned to two Couples participants.**
- [ ] **Step 4: Allow a merely reserved wrong card to be released and rescanned before activation. Do not allow an active/retired issued card to be moved.**
- [ ] **Step 5: Add `20260910_113000_membership_card_activation.sql` to replace the activation function so successful new activation creates the member/membership, promotes the reserved card, attaches the photo, mirrors active barcode into compatibility `member_number`, and writes audit data in one transaction.**
- [ ] **Step 6: Verify activation fails as a unit if any required participant photo/card is absent.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: assign preprinted cards from reception`.**

---

### Task 6: Require a card scan on every renewal

**Files:**
- Create: `supabase/migrations/20260910_113500_renewal_card_verification.sql`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/api/system/members/search/route.ts`
- Modify: `app/api/system/members/card/assign/route.ts`
- Modify: `app/api/system/members/enroll/route.ts`
- Create: `tests/membership-renewal-card-contract.test.mjs`

**Interfaces:** Every renewal stores a validated scanned barcode before activation. `decideRenewalCardAction(current, scanned)` returns `keep` for the same active card and `replace` for a different validated unused card.

- [ ] **Step 1: Write RED tests proving renewal cannot activate without a card scan. Cover physical-card and phone-barcode inputs as the same decoded credential value.**
- [ ] **Step 2: After renewal member confirmation, show photo/current card and require `SCAN MEMBERSHIP CARD`.**
- [ ] **Step 3: Same-card scan records verification and leaves card history unchanged.**
- [ ] **Step 4: Different unused card is reserved as a proposed renewal replacement. The old card remains active/known until activation succeeds.**
- [ ] **Step 5: Add `20260910_113500_renewal_card_verification.sql` to extend the activation transaction: successful replacement-on-renewal retires the old card with reason `renewal_replacement`, activates the new card, keeps the same member UUID/photo/history, updates compatibility `member_number`, and creates the new membership period atomically.**
- [ ] **Step 6: Verify a failed activation leaves the old card unchanged and the proposed card unactivated.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: require card verification on renewal`.**

---

### Task 7: Add standalone `Issue New Card`

**Files:**
- Create: `components/staff/IssueNewCardPanel.tsx`
- Create: `app/api/system/members/card/replace/route.ts`
- Create: `supabase/migrations/20260910_114000_card_replacement.sql`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Create: `tests/member-card-replacement-contract.test.mjs`

**Interfaces:** POST `/api/system/members/card/replace` receives `memberId`, exact `barcode`, and `reason: "lost" | "stolen" | "damaged" | "other"`. It returns the same member UUID with a new active credential. Membership start/expiry/status are unchanged.

- [ ] **Step 1: Write RED tests proving card replacement does not renew/extend membership and that the retired card cannot grant access.**
- [ ] **Step 2: Implement `IssueNewCardPanel.tsx`: staff verifies the member, sees name/photo/current card/status, selects replacement reason, scans the new preprinted card, and confirms.**
- [ ] **Step 3: Add `20260910_114000_card_replacement.sql` with a server-only transaction that locks current/new credentials, rejects every conflicting previously issued barcode, retires the old card, activates the new card, updates compatibility `member_number`, and records audit reason/system user/gym.**
- [ ] **Step 4: Wire the panel from member/reception actions without changing membership dates.**
- [ ] **Step 5: Re-run focused/full CI and commit `feat: add staff issue-new-card workflow`.**

---

### Task 8: Route reception access through card credentials

**Files:**
- Modify: `lib/barcodeAccessCore.ts`
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `tests/barcode-access-core.test.mjs`
- Modify: `tests/barcode-reception-contract.test.mjs`

**Interfaces:** `scanned payload -> credential -> member UUID -> current membership -> photo gate -> access result -> canonical check-in`.

- [ ] **Step 1: Write RED cases for active, expired, inactive, retired/replaced, unknown, and photo-required scans.**
- [ ] **Step 2: Resolve barcode against `bgm_member_card_credentials`, not directly against `bgm_members.member_number`.**
- [ ] **Step 3: Active + photo produces green `ACCESS GRANTED`, secure photo, and exactly one canonical barcode check-in.**
- [ ] **Step 4: Expired/inactive produces a red denied result with identified member/photo when available and zero granted check-ins.**
- [ ] **Step 5: Retired produces red `CARD REPLACED`; unknown produces `MEMBER/CARD NOT FOUND`; both create zero granted check-ins.**
- [ ] **Step 6: Re-run focused/full CI and commit `feat: resolve reception access through card credentials`.**

---

### Task 9: Make the member-app virtual card mirror the active physical card

**Files:**
- Create: `app/api/member/card/route.ts`
- Modify: `components/member/MemberCard.tsx`
- Modify: `components/member/MemberBarcode.tsx`
- Modify: `tests/member-barcode-contract.test.mjs`
- Modify: `tests/member-server-session.test.mjs`
- Create: `tests/member-virtual-card-contract.test.mjs`

**Interfaces:** `app/api/member/card/route.ts` reads the signed HttpOnly member-session cookie, resolves its secret with `resolveMemberSessionSecret()`, validates it with `verifyMemberSessionToken()`, and uses the returned `session.memberId`. It accepts no client-supplied member ID for authorization.

Response:

```ts
{
  barcodeValue: string | null;
  membershipStatus: "active" | "expired" | "inactive";
  expiryDate: string | null;
}
```

Rename the barcode component prop from `memberNumber` to `barcodeValue`:

```tsx
export default function MemberBarcode({
  barcodeValue,
}: {
  barcodeValue: string;
})
```

- [ ] **Step 1: Write RED tests for exact payload, leading zeroes, replacement refresh, no-card state, and rejection of unauthenticated member-card requests.**
- [ ] **Step 2: Implement `/api/member/card` using existing `resolveMemberSessionSecret()` and `verifyMemberSessionToken()` from `lib/memberServerSession.ts`; query the single active credential for that permanent member UUID.**
- [ ] **Step 3: Change `MemberCard.tsx` so barcode/status/expiry come from `/api/member/card`. `getSavedMember()` may remain for display name/email, but it is no longer the barcode source of truth.**
- [ ] **Step 4: Rename `MemberBarcode` prop to `barcodeValue` and pass the exact server value into `JsBarcode(..., { format: "CODE128" })`.**
- [ ] **Step 5: If no active card exists, do not render a fabricated barcode; show `CARD NOT LINKED — ASK RECEPTION`.**
- [ ] **Step 6: Verify same-card renewal leaves the app barcode unchanged and card replacement changes it after normal refresh/re-fetch without changing member login identity.**
- [ ] **Step 7: Re-run focused/full CI and commit `feat: mirror active physical barcode in member app`.**

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

**Interfaces:** The BGM 16-column exchange format begins with exact header `CardBarcode`; the original legacy 15-column format remains supported only by the controlled legacy path. `CardBarcode` is nullable text.

- [ ] **Step 1: Write RED tests requiring exact `CardBarcode` header, leading-zero preservation, blank-card acceptance, and zero generated BGM values.**
- [ ] **Step 2: Replace exchange `MembershipNumber` semantics with optional `CardBarcode` in core/CSV/XLSX code; never numeric-coerce it.**
- [ ] **Step 3: Add `20260910_115000_member_import_card_barcode.sql` to replace generated-number behavior in `bgm_apply_member_import_batch`: new imported people receive internal UUIDs; a card credential is linked only when a deterministic non-conflicting `CardBarcode` is supplied.**
- [ ] **Step 4: Preserve conservative matching. Blank card uses legacy linkage; conflicting card is `Conflict / Needs review`; omitted rows never delete/deactivate members.**
- [ ] **Step 5: Report safely linked cards, unlinked cards, safely imported photos, missing photos, and ambiguous/manual-review items when source assets support those counts.**
- [ ] **Step 6: Run XLSX/CSV round-trip, import safety, and full CI tests. Commit `feat: migrate members with optional preprinted card barcodes`.**

---

### Task 11: Preview verification and Production safety gate

**Files:** No Production mutation.

- [ ] **Step 1: Run the complete automated test suite, TypeScript typecheck, and production build used by CI; record exact commit/run evidence.**
- [ ] **Step 2: Run Supabase verification/advisors on Development. Confirm credential uniqueness, active/retired transitions, RLS, private photo bucket, activation/renewal/replacement transactions, and that new workflows no longer call the generated-number allocator.**
- [ ] **Step 3: Prepare the Preview for user-operated real-card tests: new assignment, renewal same card, renewal new card, standalone `Issue New Card`, retired-card denial, active grant, expired denial, and missing-photo gate.**
- [ ] **Step 4: Have the user test at least one real member-app Code 128 barcode on a representative phone with the actual reception scanner and confirm the decoded payload matches the physical card payload exactly.**
- [ ] **Step 5: Re-fetch `phase-2-operations-nfc-redesign` and `main`; confirm all implementation stayed on the development branch and Production database/deployment remained untouched.**
- [ ] **Step 6: Stop for explicit Preview/user approval. Do not merge or deploy Production automatically.**
