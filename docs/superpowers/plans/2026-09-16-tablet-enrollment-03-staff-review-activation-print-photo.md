# Staff Review, Activation, Print & Deferred Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the shared registration flow into Staff, add complete application review/verification/discount/payment activation, enforce one A4 page per member, and change PHOTO REQUIRED from a blocking gate into a repeating non-blocking reception warning.

**Architecture:** Keep the existing Staff Dashboard queue, application correction API, card reservation/replacement architecture and official-photo bucket. Extend pending applications with structured verification/payment/discount state and harden the existing activation RPC so all business rules are revalidated transactionally. Staff New Membership consumes the shared form from Plan 02 with an optional-photo policy; public possible-renewal matches are resolved inside the same review modal.

**Tech Stack:** Next.js/React/TypeScript, Supabase/PostgreSQL RPCs, existing BGM system auth/card/photo/check-in services, CSS print media, Node tests, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md`

## Global Constraints

- Preserve the current Staff Dashboard/realtime queue and current card reservation/replacement semantics.
- Staff New Membership photo options are Take Photo, Upload Image, Photo Later. Tablet photo remains mandatory.
- Renewal retains existing official photo unless explicitly replaced.
- Verification is visual only; never store student-card or same-address evidence copies.
- Active existing member match is never duplicated.
- Expired/inactive match reuses the existing member only after explicit staff confirmation.
- Couples remain one payment/transaction and activation is all-or-nothing across both participants/cards.
- For mixed Couples identity state, any ACTIVE matched participant blocks public submission; expired/inactive matches are tracked per participant. Reception may reuse each expired/inactive participant independently while unmatched participant(s) are created new, within the same atomic Couples activation.
- Discount code usage increments only in the successful activation transaction.
- Payment methods are `cash`, `card`, `other`; `other` requires description.
- `PHOTO REQUIRED` never denies an otherwise valid member. It repeats on every scan until an official photo exists.
- Print output is exactly one A4 member sheet per participant. Couples therefore produce two pages with forced page break.
- Printed rule/declaration text always comes from the application’s historical snapshots, not current settings.

---

### Task 1: Add review, verification, discount and payment persistence

**Files:**
- Create: `supabase/migrations/20260916_140000_membership_review_activation.sql`
- Create: `tests/membership-review-activation-schema.test.mjs`

**Interfaces:**
- Extends application members with participant-level verification fields.
- Extends applications with couples verification, discount/payment snapshots.
- Produces RPC `bgm_apply_membership_application_review(jsonb)` for atomic staff review/corrections/verification updates.
- Replaces/hardens `bgm_activate_membership_application` while retaining its public function name for current API compatibility.

- [ ] **Step 1: Write RED schema/RPC contracts**

Require these fields and RPC behavior markers:

```js
assert.match(sql, /id_verified_at/i);
assert.match(sql, /student_eligibility_verified_at/i);
assert.match(sql, /guardian_present_verified_at/i);
assert.match(sql, /guardian_cosign_verified_at/i);
assert.match(sql, /same_address_verified_at/i);
assert.match(sql, /discount_code_id/i);
assert.match(sql, /discount_percentage_snapshot/i);
assert.match(sql, /discount_amount_cents/i);
assert.match(sql, /final_amount_cents/i);
assert.match(sql, /payment_method/i);
assert.match(sql, /payment_received_at/i);
assert.match(sql, /bgm_apply_membership_application_review/i);
assert.match(sql, /bgm_activate_membership_application/i);
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/membership-review-activation-schema.test.mjs
```

- [ ] **Step 3: Implement persistence**

Participant columns:

```sql
id_verified_at timestamptz,
id_verified_by_system_user_id uuid references public.bgm_system_users(id),
student_eligibility_verified_at timestamptz,
student_eligibility_verified_by_system_user_id uuid references public.bgm_system_users(id),
guardian_present_verified_at timestamptz,
guardian_cosign_verified_at timestamptz
```

Application columns:

```sql
same_address_verified_at timestamptz,
same_address_verified_by_system_user_id uuid references public.bgm_system_users(id),
discount_code_id uuid references public.bgm_discount_codes(id),
discount_code_snapshot text,
discount_percentage_snapshot integer,
discount_amount_cents integer,
final_amount_cents integer,
payment_method text check (payment_method in ('cash','card','other')),
payment_other_text text,
payment_received_at timestamptz,
payment_staff_name text,
payment_system_user_id uuid references public.bgm_system_users(id)
```

`bgm_apply_membership_application_review` must lock the application/participants, reject activated/cancelled rows, write corrected fields and verification timestamps from the authenticated system user, and audit before/after data. Never accept verification actor/timestamps from the client.

- [ ] **Step 4: Harden activation RPC**

The existing function name remains `bgm_activate_membership_application`. Inside one DB transaction it must:

1. lock application, participants, staged card rows and selected discount row;
2. revalidate required verification gates by membership type/under-18 state;
3. validate `payment_method` and Other description;
4. revalidate discount active/date/max-use state in Malta-date terms;
5. calculate discount/final cents from immutable base price snapshot;
6. create unmatched member(s) and reuse explicitly approved existing member(s);
7. preserve permanent member number/history for reused members;
8. finalize one/two card assignments/replacements;
9. set official photo from application photo when present, otherwise leave missing photo allowed;
10. update member profile fields only from staff-reviewed application values;
11. increment `successful_uses` only if this transaction will commit;
12. mark application activated/payment received and audit;
13. return both member ids/numbers for Couples.

Any exception rolls back every DB change.

- [ ] **Step 5: Apply migration in development Supabase and run GREEN**

Read Supabase plugin skill first, apply migration, then:

```bash
node --test tests/membership-review-activation-schema.test.mjs
git add supabase/migrations/20260916_140000_membership_review_activation.sql tests/membership-review-activation-schema.test.mjs
git commit -m "feat: add verified membership activation transaction"
```

---

### Task 2: Reuse the shared registration form for Staff New Membership

**Files:**
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `app/staff/members/enroll/page.tsx`
- Create: `components/staff/StaffRegistrationPhotoControls.tsx`
- Modify: `components/membership/RegistrationForm.tsx`
- Create: `tests/staff-shared-registration-contract.test.mjs`

**Interfaces:**
- Staff New Membership renders `RegistrationForm mode="staff"`.
- Staff photo policy exposes `capture | upload | later`.
- Staff Renewal remains an explicit separate entry path with existing-member prefill.

- [ ] **Step 1: Write RED contract**

Assert `MembershipEnrollmentPage` imports/uses the shared RegistrationForm, does not duplicate membership-type/duration constants, retains `?kind=new` and `?kind=renewal&memberNumber=...`, and exposes Photo Later only in staff mode.

- [ ] **Step 2: Extract staff-only wrappers without rewriting working renewal logic**

Keep `MembershipEnrollmentPage` responsible for auth/gym context, entry choice and staff submission. Move the generic participant/membership fields into the shared component. Do not move authenticated APIs into public code.

- [ ] **Step 3: Implement staff photo controls**

`StaffRegistrationPhotoControls` accepts:

```ts
{
  existingPhotoUrl?: string | null;
  onCaptured(file: File): void;
  onUploaded(file: File): void;
  onPhotoLater(): void;
}
```

Upload accepts `image/jpeg`, `image/png`, `image/webp`, converts to WebP client-side before the existing system photo API; camera capture also yields WebP. Tablet component remains camera-only.

- [ ] **Step 4: Preserve existing renewal profile/card choices**

Existing renewal member fields, same-card/replacement-card staging and permanent member number behavior must remain. Existing photo is shown/retained unless replaced.

- [ ] **Step 5: Run tests and commit**

```bash
node --experimental-strip-types --test tests/staff-shared-registration-contract.test.mjs tests/staff-renewal-entrypoints.test.mjs tests/membership-renewal-card-contract.test.mjs
git add components/staff/MembershipEnrollmentPage.tsx components/staff/StaffRegistrationPhotoControls.tsx components/membership/RegistrationForm.tsx app/staff/members/enroll/page.tsx tests/staff-shared-registration-contract.test.mjs
git commit -m "refactor: share enrollment form with staff"
```

---

### Task 3: Expand staff application review for possible renewal and verification gates

**Files:**
- Modify: `components/staff/StaffMembershipReviewModal.tsx`
- Modify: `components/staff/PendingMembershipActions.tsx`
- Modify: `app/api/system/members/applications/[applicationId]/route.ts`
- Create: `tests/staff-membership-review-v2-contract.test.mjs`

**Interfaces:**
- PATCH action `save_review` persists corrections + verification through `bgm_apply_membership_application_review`.
- POST/PATCH action `reuse_existing_member` accepts `{ applicationMemberId }` and uses only the server-stored `matched_member_id` after staff confirmation.
- `reject_application` requires a nonblank reason.

- [ ] **Step 1: Write RED contract**

Require visible labels:

- `EXISTING MEMBER FOUND — POSSIBLE RENEWAL`
- `Renew Existing Member`
- `Reject Application`
- `ID / passport verified`
- `Student eligibility verified`
- `Same-address evidence verified`
- guardian presence/co-sign checks when applicable.

- [ ] **Step 2: Implement server actions**

`reuse_existing_member` never accepts an arbitrary member id from the browser. It loads the participant’s own `matched_member_id`, locks that member, rechecks it is not currently active, then sets/retains `existing_member_id` and audits the conversion.

For Couples, process participants independently; unmatched participant stays new. If a matched member has become active since tablet submission, reject conversion and require manual staff review.

- [ ] **Step 3: Update modal layout**

Show official/application photo, submitted/corrected data, price snapshot, declaration versions, duplicate contact warning, identity match state and type-specific verification section. Keep correction edits explicit; do not silently overwrite an existing member until activation.

- [ ] **Step 4: Reject path**

Require staff reason, set application cancelled/rejected state through existing status model, audit reason, leave matched member unchanged and release any staged replacement/new card reservations.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-membership-review-v2-contract.test.mjs tests/staff-application-corrections-schema.test.mjs
git add components/staff/StaffMembershipReviewModal.tsx components/staff/PendingMembershipActions.tsx app/api/system/members/applications/[applicationId]/route.ts tests/staff-membership-review-v2-contract.test.mjs
git commit -m "feat: add membership verification review workflow"
```

---

### Task 4: Add controlled discount preview and Payment Received activation API

**Files:**
- Create: `app/api/system/members/applications/[applicationId]/discount/route.ts`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: `components/staff/PendingMembershipActions.tsx`
- Create: `tests/membership-discount-payment-contract.test.mjs`

**Interfaces:**
- `POST .../discount` body `{ code }` returns preview only:

```ts
{
  code: string;
  percentage: number;
  basePriceCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
}
```

- Activation body adds `paymentMethod`, `paymentOtherText`, `staffName`, optional `discountCode`.

- [ ] **Step 1: Write RED contract**

Assert discount endpoint reads current code server-side and does not increment `successful_uses`. Assert activation route passes code/payment data to the RPC and never accepts client percentage/final amount.

- [ ] **Step 2: Implement discount preview**

Normalize code, validate active/date window/max-use without consuming a use, calculate from application `base_price_cents`, return 409 for unavailable/expired/exhausted code.

- [ ] **Step 3: Implement staff payment controls**

UI shows Base Price, Code, %, Discount, Final Total. Payment selector is Cash/Card/Other; Other reveals mandatory description. Staff name remains mandatory.

- [ ] **Step 4: Wire activation**

`PAYMENT RECEIVED — ACTIVATE` calls the existing enroll route; route authenticates gym scope and invokes hardened RPC. UI must display returned member number(s) only after success.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/membership-discount-payment-contract.test.mjs tests/pending-membership-activation-contract.test.mjs
git add app/api/system/members/applications/[applicationId]/discount/route.ts app/api/system/members/enroll/route.ts components/staff/PendingMembershipActions.tsx tests/membership-discount-payment-contract.test.mjs
git commit -m "feat: add controlled membership discounts and payment"
```

---

### Task 5: Make the membership print form exactly one A4 page per member

**Files:**
- Modify: `components/staff/StaffApplicationPrint.tsx`
- Modify: `app/staff/applications/[applicationId]/print/page.tsx`
- Modify: `app/api/system/members/applications/[applicationId]/print/route.ts`
- Create: `components/staff/MembershipA4Sheet.tsx`
- Create: `components/staff/MembershipPrintOverflowPreview.tsx`
- Modify: `components/staff/MembershipSettingsAdmin.tsx`
- Create: `tests/membership-print-a4-contract.test.mjs`

**Interfaces:**
- `MembershipA4Sheet` renders exactly one participant using application snapshots.
- `MembershipPrintOverflowPreview` reports `{ fits: boolean; measuredHeightPx: number; maxHeightPx: number }` in browser.

- [ ] **Step 1: Write RED print contract**

Require CSS:

```css
@page { size: A4 portrait; margin: 8mm; }
.bgm-member-a4-sheet { width: 194mm; height: 281mm; overflow: hidden; break-after: page; }
.bgm-member-a4-sheet:last-child { break-after: auto; }
```

Require one `MembershipA4Sheet` per participant, never one combined Couples sheet.

- [ ] **Step 2: Build compact member sheet**

Include member photo/placeholder, full current corrected details, member/card number if allocated, membership type/duration/start/expiry, base/discount/final price, payment method/staff, verification record summary, exact historical Gym Rules/declaration snapshots, member signature/date and staff signature/date. Under-18 adds guardian identity/relationship/signature/date.

For Couples, repeat shared payment/discount/application reference on both pages so each page stands alone.

- [ ] **Step 3: Add settings overflow preview**

Render a realistic worst-case sheet in a hidden measurement container when Super Admin edits rules/declarations. If `scrollHeight > clientHeight`, show `This wording will overflow the one-page A4 membership form` and disable Publish until the admin shortens the text or explicitly returns to editing. Do not shrink fonts below the approved readable print minimum set in the component.

- [ ] **Step 4: Add browser print measurement test**

Use Chromium to render Single, Student minor and Couples fixtures. Assert each `.bgm-member-a4-sheet` has no vertical overflow (`scrollHeight <= clientHeight + 1`) and Couples has exactly two sheets.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/membership-print-a4-contract.test.mjs
npm run build
node tests/browser/staff-dashboard.mjs
git add components/staff/StaffApplicationPrint.tsx components/staff/MembershipA4Sheet.tsx components/staff/MembershipPrintOverflowPreview.tsx components/staff/MembershipSettingsAdmin.tsx app/staff/applications/[applicationId]/print/page.tsx app/api/system/members/applications/[applicationId]/print/route.ts tests/membership-print-a4-contract.test.mjs
git commit -m "feat: enforce one-page A4 membership forms"
```

---

### Task 6: Change PHOTO REQUIRED to a non-blocking repeating scan warning

**Files:**
- Create: `supabase/migrations/20260916_141000_nonblocking_photo_warning.sql`
- Modify: `app/api/system/barcode/scan/route.ts`
- Modify: `components/staff/BarcodeReceptionPage.tsx`
- Modify: `components/staff/OfficialMemberPhotoCapture.tsx`
- Modify: `tests/reception-card-photo-gate-contract.test.mjs`
- Modify: `tests/member-photo-contract.test.mjs`

**Interfaces:**
- Barcode scan response remains `granted: true` for valid membership even with no photo.
- Response member includes `photoRequired: true` until official photo exists.
- Access scan stores warning separately from access decision.

- [ ] **Step 1: Rewrite the failing contract to the newly approved behavior**

The current branch intentionally blocks a valid member with `result: "photo_required", granted: false`. Replace that expectation with:

```js
assert.match(scanRoute, /decision = membershipDecision/);
assert.doesNotMatch(scanRoute, /photo_required.*granted:\s*false/);
assert.match(scanRoute, /photoRequired:\s*!hasPhoto/);
```

Also require canonical check-in creation occurs when membership is valid even if `official_photo_path` is null.

- [ ] **Step 2: Add scan-warning persistence**

Add `photo_required_warning boolean not null default false` to `bgm_access_scans`. Existing historical `result='photo_required'` rows remain readable; do not delete history. New scans use normal access result (`granted`, `expired`, etc.) plus warning boolean.

- [ ] **Step 3: Modify scan route**

Remove the branch that converts granted membership to denied `photo_required`. Set `photo_required_warning: !hasPhoto` on scan insert, create normal check-in, and return `photoRequired: !hasPhoto`.

Use a Malta-date helper instead of `new Date().toISOString().slice(0,10)` so expiry evaluation does not slip around midnight Malta time.

- [ ] **Step 4: Update reception popup**

For `granted && photoRequired`, play/display normal green access success plus a separate prominent red/orange `PHOTO REQUIRED` warning. Buttons: **Take Photo with Webcam**, **Upload Photo**, **Allow Entry / Close**. Closing does not clear the warning state.

- [ ] **Step 5: Reuse existing official-photo API**

After capture/upload succeeds, refresh member data and show photo. No separate `photo_required` database flag is needed: missing `official_photo_path` is the source of truth. The next scan naturally stops warning after photo exists.

- [ ] **Step 6: GREEN and commit**

```bash
node --experimental-strip-types --test tests/reception-card-photo-gate-contract.test.mjs tests/member-photo-contract.test.mjs tests/member-card-barcode-scan-contract.test.mjs
git add supabase/migrations/20260916_141000_nonblocking_photo_warning.sql app/api/system/barcode/scan/route.ts components/staff/BarcodeReceptionPage.tsx components/staff/OfficialMemberPhotoCapture.tsx tests/reception-card-photo-gate-contract.test.mjs tests/member-photo-contract.test.mjs
git commit -m "feat: make missing photo a nonblocking reception warning"
```

---

### Task 7: Expand Staff browser coverage for full enrollment lifecycle

**Files:**
- Modify: `tests/browser/staff-dashboard.mjs`
- Modify: `tests/browser/tablet-enrollment.mjs`

- [ ] **Step 1: Add tablet -> staff queue handoff fixture**

Mock a submitted tablet application and assert Staff queue shows the new item with correct membership type and snapshot price.

- [ ] **Step 2: Add possible-renewal flow**

Open a flagged application, choose Renew Existing Member, assert UI changes card choices to Keep Existing / Replacement and never offers a new permanent member number before activation.

- [ ] **Step 3: Add verification/payment activation flow**

Assert activation button is blocked before required checks, then succeeds after ID/student/etc verification and payment fields. Assert discount preview renders values and activation response renders permanent number(s).

- [ ] **Step 4: Add PHOTO REQUIRED scan case**

Mock valid member without photo; assert green granted state and separate PHOTO REQUIRED warning are both visible. Click Allow Entry without photo and ensure flow closes. Reopen, simulate webcam upload, assert warning clears only after API success.

- [ ] **Step 5: Add A4 screenshots and commit**

Capture review popup, activation success, photo-warning popup and print sheet artifacts.

```bash
npm run build
node tests/browser/staff-dashboard.mjs
node tests/browser/tablet-enrollment.mjs
git add tests/browser/staff-dashboard.mjs tests/browser/tablet-enrollment.mjs
git commit -m "test: cover complete staff enrollment lifecycle"
```

---

### Task 8: Plan-03 verification gate

- [ ] **Step 1: Run targeted tests**

```bash
node --experimental-strip-types --test \
  tests/membership-review-activation-schema.test.mjs \
  tests/staff-shared-registration-contract.test.mjs \
  tests/staff-membership-review-v2-contract.test.mjs \
  tests/membership-discount-payment-contract.test.mjs \
  tests/membership-print-a4-contract.test.mjs \
  tests/reception-card-photo-gate-contract.test.mjs \
  tests/member-photo-contract.test.mjs
```

- [ ] **Step 2: Run all repository tests + typecheck/build**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

- [ ] **Step 3: Run browser verification**

```bash
node tests/browser/member-card-gyms.mjs
node tests/browser/staff-dashboard.mjs
node tests/browser/tablet-enrollment.mjs
```

- [ ] **Step 4: Real local Staff + tablet walkthrough through temporary HTTPS tunnel**

Exercise one Regular, Student, Couples, expired-member renewal conversion and Staff Photo Later case against development Supabase. Verify one A4 page/member using browser print preview. Do not deploy to Vercel.

Plan 04 starts only when this online workflow is stable.