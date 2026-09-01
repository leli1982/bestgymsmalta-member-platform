# Phase 2 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the secure member API baseline plus the database/auth/permission foundations required for shared per-gym logins, enrollment workflows and later NFC/order features without changing production behavior.

**Architecture:** Keep the current member credential model but authorize private member APIs with the signed HttpOnly member session. Add Phase 2 operational schema as migrations committed to Git before any live database application. Shared gym accounts use server-side username/password authentication with bcrypt hashes, signed HttpOnly system sessions and granular permission checks; Super Admin bypasses ordinary permission checks server-side.

**Tech Stack:** Next.js 16, TypeScript, Supabase PostgreSQL/Storage, bcryptjs, signed HMAC HttpOnly cookies, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-09-01-phase-2-operations-nfc-redesign-design.md`

## Global Constraints

- Work only on `phase-2-operations-nfc-redesign`; never write directly to `main`.
- BestGymsMalta membership and member visibility are network-wide; gym/enrollment location is reporting context only.
- Existing `bgm_members.status` and `bgm_members.membership_expiry` remain compatibility fields.
- Existing member features must continue working during Phase 2.
- New database migrations are authored in Git first and are not applied to the live Supabase database until a controlled migration checkpoint.
- One operational login exists per gym; there is no staff sub-login.
- Staff Name is a required form field only on operational forms that need human attribution.
- Super Admin has unrestricted server-side access.
- Offline emergency roster stores only member number and full name.

---

### Task 1: Complete member-private API session enforcement

**Files:**
- Modify: `app/api/member/progress-photos/route.ts`
- Modify: `app/api/member/strength-progress/route.ts`
- Modify: `app/api/member/workout-plan/route.ts`
- Modify: `app/api/checkins/route.ts`
- Modify: `lib/memberAuth.ts`
- Test: `tests/member-server-session.test.mjs`
- Test: `tests/member-client-session.test.mjs`

**Interfaces:**
- Consumes: `requireMemberSession(request: NextRequest, requestedMemberId?: string)` from `lib/memberAuth.ts`.
- Produces: every active private route rejects a missing/invalid/cross-member session before querying member-private data.

- [x] **Step 1: Add token/session tests for valid, tampered, expired and cross-member sessions.**

- [x] **Step 2: Verify the tests fail before the missing behavior is implemented, then make them green.**

- [x] **Step 3: Issue the member session cookie from successful member login and activation.**

- [x] **Step 4: Add secure logout and expire the server cookie from the shared client logout helper.**

- [x] **Step 5: Require the member session for progress photos and verify Vercel Preview succeeds.**

- [x] **Step 6: Require the member session for strength progress and verify Vercel Preview succeeds.**

- [x] **Step 7: Require the member session for workout plans and verify Vercel Preview succeeds.**

- [x] **Step 8: Require the member session for QR/check-ins and verify Vercel Preview succeeds.**

### Task 2: Add the Phase 2 operational database foundation as a Git migration

**Files:**
- Create: `supabase/migrations/20260901_120000_phase2_operations_foundation.sql`
- Create: `tests/phase2-schema-contract.test.mjs`

**Interfaces:**
- Produces tables: `bgm_system_users`, `bgm_user_permissions`, `bgm_audit_log`, `bgm_membership_applications`, `bgm_membership_application_members`, `bgm_memberships`, `bgm_membership_members`.
- Extends: `bgm_members` with enrollment/profile fields while keeping all current fields.
- Consumes: `bgm_gyms(id)` and `bgm_members(id)`.

- [ ] **Step 1: Write a failing schema-contract test that reads the migration and asserts every required table, RLS enable statement, membership type/duration constraint and one-login-per-gym unique index exists.**

Run:
```bash
node --test tests/phase2-schema-contract.test.mjs
```
Expected before migration: FAIL because `supabase/migrations/20260901_120000_phase2_operations_foundation.sql` does not exist.

- [ ] **Step 2: Create the migration with explicit tables and constraints.**

Core system-account SQL must include:
```sql
create table if not exists public.bgm_system_users (
  id uuid primary key default gen_random_uuid(),
  gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  username text not null,
  password_hash text not null,
  display_name text not null,
  is_super_admin boolean not null default false,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_system_users_username_lower_key
  on public.bgm_system_users (lower(username));

create unique index if not exists bgm_system_users_one_login_per_gym_key
  on public.bgm_system_users (gym_id)
  where gym_id is not null;
```

Permission SQL must use a composite primary key and presence/`allowed = true` semantics:
```sql
create table if not exists public.bgm_user_permissions (
  system_user_id uuid not null references public.bgm_system_users(id) on delete cascade,
  permission_key text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (system_user_id, permission_key)
);
```

Every new operational table must end with:
```sql
alter table public.<table_name> enable row level security;
```
No public `anon` policy is created for these operational tables.

- [ ] **Step 3: Add the enrollment/application schema.**

`bgm_membership_applications` must contain at minimum:
- UUID primary key
- unique application reference
- `membership_type` constrained to `single|couples|student`
- `duration_key` constrained to `1_week|2_weeks|1_month|3_months|6_months|1_year`
- `enrollment_gym_id` FK to `bgm_gyms`
- required `staff_name`
- status constrained to `draft|submitted|awaiting_payment|activated|cancelled`
- submit/payment/activation/cancellation timestamps
- creating system-user reference

`bgm_membership_application_members` must store participant order (1 or 2), full enrollment details and private official-photo path before activation.

- [ ] **Step 4: Add activated membership contracts.**

`bgm_memberships` stores membership type, duration, start/expiry, enrollment gym, application link, activation staff name, activating system user and contract status.

`bgm_membership_members` links one Single/Student contract to one member or one Couples contract to two member records and prevents duplicate membership/member pairs.

- [ ] **Step 5: Extend `bgm_members` additively.**

Add nullable columns only so existing rows remain valid:
```sql
alter table public.bgm_members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists postcode text,
  add column if not exists id_number text,
  add column if not exists date_of_birth date,
  add column if not exists next_of_kin text,
  add column if not exists enrollment_gym_id text references public.bgm_gyms(id),
  add column if not exists official_photo_path text;
```

- [ ] **Step 6: Run the schema-contract test and verify it passes.**

Run:
```bash
node --test tests/phase2-schema-contract.test.mjs
```
Expected: PASS.

- [ ] **Step 7: Do not apply this migration to live Supabase yet. Commit it to the feature branch and require a successful Vercel Preview build.**

### Task 3: Add shared gym/Super Admin authentication

**Files:**
- Create: `lib/systemSession.ts`
- Create: `lib/systemAuth.ts`
- Create: `app/api/system/auth/login/route.ts`
- Create: `app/api/system/auth/logout/route.ts`
- Create: `app/api/system/auth/session/route.ts`
- Test: `tests/system-session.test.mjs`

**Interfaces:**
- Produces: signed `bgm_system_session` HttpOnly cookie containing only system-user ID and expiry.
- Produces: `requireSystemUser()` and `requirePermission(permissionKey)` helpers for future operational APIs.
- Consumes: `bgm_system_users` and `bgm_user_permissions` after the database migration is applied at the controlled checkpoint.

- [ ] **Step 1: Write failing pure-token tests mirroring the member-session guarantees: valid, tampered, expired.**

- [ ] **Step 2: Add a permission-decision test proving `is_super_admin = true` always grants while an ordinary gym account requires an explicit allowed permission key.**

- [ ] **Step 3: Implement the signed system-session token and cookie helpers.**

- [ ] **Step 4: Implement username/password login using `bcrypt.compare` against `bgm_system_users.password_hash`; reject inactive accounts.**

- [ ] **Step 5: Update `last_login_at` after successful login and issue the HttpOnly cookie.**

- [ ] **Step 6: Implement logout/session endpoints and verify Vercel Preview compiles.**

### Task 4: Add Super Admin gym-account and permission management APIs

**Files:**
- Create: `app/api/system/users/route.ts`
- Create: `app/api/system/users/[id]/route.ts`
- Create: `app/api/system/users/[id]/permissions/route.ts`
- Create: `lib/permissionCatalog.ts`
- Test: `tests/system-permissions.test.mjs`

**Interfaces:**
- Consumes: authenticated Super Admin system session.
- Produces: create/reset/enable/disable one gym operational login and replace its explicit permission set.

- [ ] **Step 1: Encode the exact permission catalog from the design spec in `permissionCatalog.ts`.**

- [ ] **Step 2: Write tests proving duplicate usernames and a second login for the same gym are rejected by validation before database mutation.**

- [ ] **Step 3: Create a gym user with a bcrypt hash; never return `password_hash` from an API.**

- [ ] **Step 4: Implement permission replacement transaction semantics so the submitted set becomes the complete explicit permission set for that gym user.**

- [ ] **Step 5: Require Super Admin server-side on every user/permission mutation route and verify Preview build.**

### Task 5: Replace destructive CSV import semantics before relational Phase 2 records go live

**Files:**
- Modify: `app/api/admin/members/import/route.ts`
- Test: `tests/member-import-plan.test.mjs`

**Interfaces:**
- Produces: non-destructive import preview/upsert result with `new`, `updated`, `unchanged`, `conflicts` counts/lists.
- Removes: automatic deletion of members omitted from the incoming CSV.

- [ ] **Step 1: Write a failing test demonstrating that a current member omitted from an import is not included in a deletion plan.**

- [ ] **Step 2: Separate parsing/diff calculation from database mutation into a pure helper that the test can execute.**

- [ ] **Step 3: Make normal import upsert only incoming valid rows and return preview/diff information.**

- [ ] **Step 4: Keep archive/deactivation outside normal import; do not add an automatic delete fallback.**

- [ ] **Step 5: Verify existing member activation/login fields are preserved for unchanged existing members unless explicitly changed by an authorized operation.**

### Task 6: Expand QA and establish the controlled database checkpoint

**Files:**
- Modify: `QA_CHECKLIST.md`

**Interfaces:**
- Produces: explicit human regression gate before applying migrations to the live project.

- [ ] **Step 1: Add member-session regression checks: login, activation, progress photos, strength, trainer, passport/check-ins and logout.**

- [ ] **Step 2: Add future system-account checks: shared gym username, wrong password, inactive account, Super Admin bypass and permission denial.**

- [ ] **Step 3: Add network-wide visibility check: an authorized gym account can find a member enrolled at another gym.**

- [ ] **Step 4: Add migration checks: existing member row counts retained, existing QR check-ins retained, existing progress/trainer data retained.**

- [ ] **Step 5: Stop for human Preview regression testing. Only after confirmation choose the controlled Supabase migration window.**

---

## Follow-up Plans

After this foundation is accepted, create separate implementation plans for:

1. Tablet enrollment + printing + official member photos.
2. NFC card assignment + reception scanner + access logs.
3. Sundries and bar orders + manager notification.
4. Offline emergency roster PWA/IndexedDB sync.
5. Admin/staff light redesign and member-app visual redesign.
