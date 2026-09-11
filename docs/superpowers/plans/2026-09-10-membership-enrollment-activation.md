# Membership Enrollment & Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe NEW MEMBERSHIP / RENEWAL staff workflow where applications can be prepared/printed without activation, Staff Name is mandatory at both application and payment activation, new permanent identities are allocated only at successful activation, and renewals always reuse existing identities.

**Architecture:** Staff creates an application first, then a separate `PAYMENT RECEIVED — ACTIVATE` operation performs one transactional database commit. A pure enrollment helper guards new-vs-renewal identity decisions; server routes enforce granular permissions and mandatory Staff Name; a follow-up SQL migration adds application linkage and an atomic activation function. Renewal search is conservative and never treats legacy PK as unique.

**Tech Stack:** Next.js 16 / React / TypeScript, Supabase/PostgreSQL, existing signed system-session auth, Node built-in test runner, GitHub Actions Phase 2 CI.

**Spec:** `docs/superpowers/specs/2026-09-10-membership-enrollment-activation-design.md`

## Global Constraints

- Work only on `phase-2-operations-nfc-redesign`; never write to `main`.
- Production remains untouched until explicit Preview acceptance.
- Printing/submission never activates a membership.
- The only activation UI action is `PAYMENT RECEIVED — ACTIVATE`.
- `Staff Name` is mandatory for both NEW MEMBERSHIP and RENEWAL application submission.
- `Activation Staff Name` is separately mandatory when payment is confirmed and activation occurs.
- Store both authenticated system/gym account identity and entered Staff Name for accountability.
- New applications do not consume permanent BGM numbers before successful activation.
- Renewal always reuses existing `bgm_members.id`, permanent member number and barcode.
- Never use `pkCustomer` alone as a unique member identity.
- Membership is network-wide; enrollment gym is reporting context only.
- NFC remains dormant; barcode is the launch credential.
- Existing member/admin/barcode/check-in functionality must keep working.

---

### Task 1: Add enrollment identity and Staff Name contracts

**Files:**
- Create: `tests/membership-enrollment-core.test.mjs`
- Create: `lib/membershipEnrollmentCore.ts`

**Interfaces:**
- Produces: `buildEnrollmentIdentityAction({ kind, existingMemberId })`.
- Produces: `requireStaffName(value, label?)`.
- Produces: `calculateMembershipExpiry(startDate, durationKey)`.

- [ ] **Step 1: Write failing tests**

Test that `new` returns `{ kind: "create_person" }`, renewal without an existing member throws, renewal with `m1` returns `{ kind: "reuse_person", memberId: "m1" }`, blank Staff Name throws, trimmed Staff Name is returned, and approved durations calculate deterministic inclusive expiry dates.

- [ ] **Step 2: Verify RED**

Run the Phase 2 CI test command after committing only tests. Expected: new test file fails because `lib/membershipEnrollmentCore.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Implement exact `new | renewal` validation, non-empty trimmed Staff Name validation, strict ISO start-date validation and duration expiry calculation for `1_week`, `2_weeks`, `1_month`, `3_months`, `6_months`, `1_year`.

- [ ] **Step 4: Verify GREEN**

Run focused tests and then the full suite.

---

### Task 2: Add follow-up enrollment schema and atomic activation transaction

**Files:**
- Create: `supabase/migrations/20260910_100000_membership_enrollment_activation.sql`
- Create: `tests/membership-enrollment-schema.test.mjs`

**Interfaces:**
- Adds: `bgm_membership_applications.application_kind` constrained to `new | renewal`.
- Adds: `bgm_membership_application_members.existing_member_id` FK to `bgm_members`.
- Produces: `public.bgm_activate_membership_application(uuid,text,uuid)` transactional function.

- [ ] **Step 1: Write failing schema-contract test**

Require the migration to contain `application_kind`, `existing_member_id`, mandatory activation Staff Name validation, new-vs-renewal branching, inserts into `bgm_memberships`/`bgm_membership_members`, compatibility status/expiry updates, application activation, and audit insertion.

- [ ] **Step 2: Verify RED**

Run CI/tests before creating the migration; expected failure is the missing migration.

- [ ] **Step 3: Implement migration**

Activation function rules:
- reject blank activation Staff Name;
- lock application row `FOR UPDATE`;
- accept only submitted/awaiting-payment applications;
- reject no participants;
- for `new`, every participant must have no `existing_member_id`; create each `bgm_members` row omitting `member_number` so the DB allocator supplies it;
- for `renewal`, every participant must have an `existing_member_id`; never insert a new person row;
- create one `bgm_memberships` period and link one/two participants with primary/partner roles;
- update each affected `bgm_members.status='active'`, `membership_expiry`, enrollment context and profile fields where supplied;
- mark application `activated`, set payment/activation timestamps and reviewer system user;
- insert audit rows with activation Staff Name;
- return application ID, membership ID and affected member IDs/numbers.

Revoke default PUBLIC execute on the SECURITY DEFINER function and grant only service-role/internal execution as appropriate for server-only use.

- [ ] **Step 4: Apply only to Development Supabase**

Apply the reviewed migration to project `jsuolemirhivqhjbjetv`, never Production.

- [ ] **Step 5: Verify schema**

Query information_schema and pg_proc/constraints to confirm linkage columns, constraints and function exist.

---

### Task 3: Add safe member search API for renewal

**Files:**
- Create: `app/api/system/members/search/route.ts`
- Create: `tests/membership-enrollment-search-contract.test.mjs`

**Interfaces:**
- `GET /api/system/members/search?q=...`
- Requires `members.view`.

- [ ] **Step 1: Write failing route contract test**

Require exact permanent number lookup first and fallback candidate search over name/mobile/email/legacy PK without auto-selecting ambiguous legacy matches.

- [ ] **Step 2: Verify RED**

Expected failure: route absent.

- [ ] **Step 3: Implement search route**

Use `requireSystemPermission(request, "members.view")`. Normalize exact BGM membership numbers. For fallback search, issue separate Supabase queries and deduplicate by member ID rather than constructing an unsafe raw `.or(...)` expression from user input. Return only confirmation-safe fields and cap result count.

- [ ] **Step 4: Verify GREEN**

Run focused and full tests/typecheck.

---

### Task 4: Add application creation and payment activation API

**Files:**
- Create: `app/api/system/members/enroll/route.ts`
- Create: `tests/membership-enrollment-contract.test.mjs`

**Interfaces:**
- `POST /api/system/members/enroll` with action `create_application` or `activate`.

- [ ] **Step 1: Write failing API contract tests**

Require:
- `members.create` for new applications;
- `members.renew` for renewal applications;
- `membership.activate` for activation;
- `Staff Name` mandatory server-side on both new and renewal application creation;
- separate `activationStaffName` mandatory for activation;
- renewal references confirmed existing member IDs;
- activation calls only the transactional DB function;
- no client-generated permanent member number.

- [ ] **Step 2: Verify RED**

Expected failure: route absent.

- [ ] **Step 3: Implement `create_application`**

Validate application kind, membership type, duration, enrollment gym, start date, participants and required Staff Name. Gym accounts use their own authenticated gym context; Super Admin may supply a valid active gym. Insert application + participant snapshot records. For renewal, verify every selected existing member exists before inserting the application. Write an `application_submitted` audit record with the Application Staff Name.

- [ ] **Step 4: Implement `activate`**

Validate required Activation Staff Name and `membership.activate`, then call the transactional activation function with application ID, activation Staff Name and authenticated system-user ID. Do not perform membership/person inserts directly in the route.

- [ ] **Step 5: Verify GREEN**

Run focused tests, full suite, typecheck and build.

---

### Task 5: Build staff NEW MEMBERSHIP / RENEWAL UI

**Files:**
- Create: `components/staff/MembershipEnrollmentPage.tsx`
- Create: `app/staff/members/enroll/page.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Create: `tests/membership-enrollment-ui-contract.test.mjs`

**Interfaces:**
- Staff entry: `/staff/members/enroll`.

- [ ] **Step 1: Write failing UI contract test**

Require visible `NEW MEMBERSHIP`, `RENEWAL`, `Staff Name`, `PAYMENT RECEIVED — ACTIVATE`, renewal permanence copy, member-search endpoint usage and Members tile navigation.

- [ ] **Step 2: Verify RED**

Expected failure: component/page absent and Members tile has no enrollment href.

- [ ] **Step 3: Implement first-choice UI**

Screen 1: two large buttons `NEW MEMBERSHIP` / `RENEWAL`.

New flow: membership type, duration, start date, participant data, required Application Staff Name, submit/printable confirmation, then separate required Activation Staff Name + `PAYMENT RECEIVED — ACTIVATE`.

Renewal flow: search existing database first, explicitly select the correct member, display permanent number and `This number and barcode stay with this member.`, then membership details + required Application Staff Name, submit/print, then required Activation Staff Name + activation.

- [ ] **Step 4: Add staff navigation**

Make Members tile link to `/staff/members/enroll` whenever the user has any member operational permission needed for the workflow; do not alter `/bgm-admin` member management.

- [ ] **Step 5: Verify GREEN**

Run full test suite, `npx tsc --noEmit`, `npm run build`.

---

### Task 6: Final branch verification

**Files:**
- No production-file changes unless verification exposes a defect.

- [ ] **Step 1: Run complete Phase 2 CI**

Expected: all tests pass, typecheck passes, build passes.

- [ ] **Step 2: Verify Development DB only**

Confirm no application/activation changes were made to Production. Confirm Development has the new schema/function.

- [ ] **Step 3: Verify branch isolation**

Confirm `phase-2-operations-nfc-redesign` advanced and `main` remained unchanged.

- [ ] **Step 4: Report checkpoint**

Summarize exact commits/tests and ask `Do you want me to continue?`

## Plan Self-Review Result

- **Spec coverage:** New vs renewal, permanent-number allocation timing, renewal reuse, mandatory Application Staff Name, separately mandatory Activation Staff Name, permissions, network-wide gym context, transactional activation, audit attribution and barcode-only launch are covered.
- **Placeholder scan:** no TBD/TODO implementation placeholders are used.
- **Type consistency:** application kind is consistently `new | renewal`; system permissions use existing keys; activation uses one database function boundary.
