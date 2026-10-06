# Staff Attendance & Payroll Plan 01 — Foundation, Employees & Pay Configuration

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Follow TDD: write the failing test, prove RED, implement minimally, prove GREEN, then commit.

**Goal:** Establish the deployment-safe implementation branch, attendance/payroll database foundation, pure payroll-domain rules, employee management, effective-dated hourly rates/Full Time-Part Time history, public-holiday versioning and staff photos.

**Architecture:** Add dedicated staff-employment tables rather than reusing `bgm_system_users`. Store money as integer cents and holiday multipliers as integer basis points. Use effective-dated history plus immutable payroll snapshots later. All APIs in this plan are Super Admin only and write into the existing central audit trail.

**Tech Stack:** Next.js 16, TypeScript, React, Tailwind, Supabase/PostgreSQL/Storage, Node 22 tests, existing `requireSuperAdmin`, existing audit and photo-upload patterns.

**Spec:** `docs/superpowers/specs/2026-10-06-staff-attendance-payroll-design.md`

## Global Constraints

- Do not touch Production Supabase in this plan.
- TEST Supabase is `vlvyqdjhzdcxatilbdiv`; Production is `jsuolemirhivqhjbjetv`.
- Employee records are separate from Staff Portal login records.
- Full Time/Part Time and hourly wage are historical/effective-dated.
- Public-holiday multipliers are historical and have separate Full Time and Part Time values.
- Deactivate employees; do not hard-delete historical employees.
- All writes are Super Admin only and centrally audited.
- Employee photos are private storage; no biometric image is stored.

## Task 1: Protect and create the implementation branch

**Files:**
- Modify: `vercel.json`
- Modify: `.github/workflows/phase2-ci.yml`
- Modify/Create test: `tests/vercel-deployment-guard.test.mjs`

**Interfaces:**
- Vercel suppression key: `feature/staff-attendance-payroll: false`.
- CI push branch: `feature/staff-attendance-payroll`.

- [ ] **Step 1: Extend the deployment-guard test and prove RED**

Add an assertion that `vercel.json` contains the exact feature branch with `false`.

```js
assert.equal(
  config.git.deploymentEnabled["feature/staff-attendance-payroll"],
  false
);
```

Run:

```bash
node --test tests/vercel-deployment-guard.test.mjs
```

Expected: FAIL before config is changed.

- [ ] **Step 2: Add the Vercel guard and CI branch trigger**

Preserve every existing deployment guard. Add only the new branch key. Add the same branch to the Phase 2 CI `push.branches` list.

- [ ] **Step 3: Re-run guard test**

Expected: PASS.

- [ ] **Step 4: Commit branch-safety changes on the current spec branch**

```bash
git add vercel.json .github/workflows/phase2-ci.yml tests/vercel-deployment-guard.test.mjs
git commit -m "chore: protect staff attendance feature branch"
```

- [ ] **Step 5: Verify no Vercel deployment was created, then create isolated implementation branch/worktree**

Read `superpowers:using-git-worktrees` first. Create `feature/staff-attendance-payroll` from the exact guard commit. From this point implementation happens only on that feature branch/worktree.

---

## Task 2: Add staff-employment/payroll foundation schema

**Files:**
- Create: `supabase/migrations/20261006_120000_staff_attendance_payroll.sql`
- Create: `tests/staff-attendance-schema.test.mjs`

**Interfaces:**
- New tables:
  - `bgm_staff_employees`
  - `bgm_staff_employment_type_history`
  - `bgm_staff_rate_history`
  - `bgm_staff_public_holidays`
  - `bgm_staff_public_holiday_versions`
  - `bgm_staff_terminals`
  - `bgm_staff_biometrics`
  - `bgm_staff_punch_events`
  - `bgm_staff_work_sessions`
  - `bgm_staff_session_payroll_segments`
  - `bgm_staff_attendance_adjustments`
- Private storage bucket: `bgm-staff-photos`.

- [ ] **Step 1: Write schema contract tests and prove RED**

Assertions must cover exact table names, key checks, one-open-session partial unique index, immutable punch-event protection, RLS enabled and no public/anon grants.

Minimum source checks:

```js
assert.match(sql, /create table(?: if not exists)? public\.bgm_staff_employees/i);
assert.match(sql, /bgm_staff_employment_type_history/i);
assert.match(sql, /bgm_staff_rate_history/i);
assert.match(sql, /bgm_staff_public_holiday_versions/i);
assert.match(sql, /bgm_staff_punch_events/i);
assert.match(sql, /bgm_staff_work_sessions/i);
assert.match(sql, /bgm_staff_session_payroll_segments/i);
assert.match(sql, /where clock_out_at is null/i);
```

Run:

```bash
node --test tests/staff-attendance-schema.test.mjs
```

Expected: FAIL because migration does not exist.

- [ ] **Step 2: Implement canonical employee/config tables**

Use this model:

```sql
create table public.bgm_staff_employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (btrim(first_name) <> ''),
  surname text not null check (btrim(surname) <> ''),
  id_number text not null check (btrim(id_number) <> ''),
  address text,
  mobile text,
  email text,
  home_gym_id text references public.bgm_gyms(id) on update cascade on delete restrict,
  photo_path text,
  linked_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  active boolean not null default true,
  created_by_system_user_id uuid references public.bgm_system_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Use a case-insensitive unique index on normalized `id_number` unless TEST data proves legitimate duplicates; if duplicates exist, stop and surface them rather than silently weakening identity uniqueness.

Employment type history:

```sql
(employee_id uuid, employment_type text check in ('full_time','part_time'), effective_from date, created_by_system_user_id uuid, created_at timestamptz)
```

Unique `(employee_id, effective_from)`.

Hourly-rate history:

```sql
(employee_id uuid, hourly_rate_cents integer check >= 0, effective_from date, created_by_system_user_id uuid, created_at timestamptz)
```

Unique `(employee_id, effective_from)`.

Public holiday identity and versions:

```sql
bgm_staff_public_holidays(id, holiday_date date, created_at)
bgm_staff_public_holiday_versions(
  id, holiday_id, version_no,
  name,
  full_time_multiplier_bps integer check > 0,
  part_time_multiplier_bps integer check > 0,
  active boolean,
  note,
  effective_created_at,
  superseded_at,
  created_by_system_user_id
)
```

Enforce one active/current version per holiday identity. `10000` means 1.0x; `20000` means 2.0x.

- [ ] **Step 3: Add attendance tables now so later tasks do not require schema churn**

`bgm_staff_terminals` contains gym, friendly name, credential hash, active status, optional vendor/model metadata and last_seen.

`bgm_staff_biometrics` contains employee, active/status, adapter/vendor/template reference metadata and optional encrypted template payload. Explicitly prohibit raw fingerprint image/photo columns.

`bgm_staff_punch_events` is append-only and stores source timestamp plus normalized effective minute timestamp, action, gym, terminal/manual source, event/idempotency key, actor/reason metadata.

`bgm_staff_work_sessions` stores effective clock-in/out timestamps, gyms, punch-event references, status and update metadata.

Create a partial unique index so each employee has at most one row with `clock_out_at is null` and non-void status.

`bgm_staff_session_payroll_segments` stores immutable per-calendar-date calculation snapshots: date, minutes, rate-history ID/rate cents, employment-history ID/type, holiday-version ID/multiplier BPS, pay cents.

`bgm_staff_attendance_adjustments` stores immutable before/after JSON, mandatory reason and acting Super Admin.

- [ ] **Step 4: Protect immutable evidence**

Create a trigger/function that rejects UPDATE/DELETE of `bgm_staff_punch_events` through normal DB paths. Corrections occur in session/adjustment records, never by mutating evidence.

Enable RLS on all new tables; service role is the application access path. Revoke public/anon/authenticated direct access, matching the existing app architecture.

- [ ] **Step 5: Add private staff-photo bucket**

Create `bgm-staff-photos` as private in migration/controlled SQL consistent with current Supabase storage conventions.

- [ ] **Step 6: Run schema test GREEN**

```bash
node --test tests/staff-attendance-schema.test.mjs
```

- [ ] **Step 7: Apply only to TEST Supabase and introspect**

Use the installed Supabase connector. Confirm table/index/trigger/bucket existence, RLS posture and zero preexisting employee rows. Do not apply to Production.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261006_120000_staff_attendance_payroll.sql tests/staff-attendance-schema.test.mjs
git commit -m "feat: add staff attendance payroll schema"
```

---

## Task 3: Add pure effective-date and payroll configuration rules

**Files:**
- Create: `lib/staffAttendanceCore.ts`
- Create: `tests/staff-attendance-core.test.mjs`

**Interfaces:**

```ts
export type EmploymentType = "full_time" | "part_time";
export type StaffRateHistory = { id: string; effectiveFrom: string; hourlyRateCents: number };
export type StaffEmploymentHistory = { id: string; effectiveFrom: string; employmentType: EmploymentType };
export type HolidayVersion = { id: string; holidayDate: string; active: boolean; fullTimeMultiplierBps: number; partTimeMultiplierBps: number };
export function effectiveRecordOn<T extends { effectiveFrom: string }>(records: T[], date: string): T | null;
export function holidayMultiplierBps(version: HolidayVersion | null, type: EmploymentType): number;
export function calculatePayCents(minutes: number, hourlyRateCents: number, multiplierBps: number): number;
export function normalizePunchMinute(value: Date): Date;
```

- [ ] **Step 1: Write RED unit tests**

Cover:
- effective-from selection before/at/after wage change;
- Part Time -> Full Time change;
- Full Time and Part Time holiday multiplier selection;
- normal day multiplier = 10000;
- exact minute normalization (seconds/milliseconds removed once at punch ingestion);
- deterministic pay rounding to nearest euro cent only at each persisted segment.

Examples:

```js
assert.equal(calculatePayCents(60, 850, 10000), 850);
assert.equal(calculatePayCents(30, 850, 20000), 850);
```

- [ ] **Step 2: Prove RED**

```bash
node --experimental-strip-types --test tests/staff-attendance-core.test.mjs
```

- [ ] **Step 3: Implement minimal pure helpers**

`normalizePunchMinute` truncates source timestamp seconds/milliseconds to the beginning of that minute. Raw source timestamp remains elsewhere for audit evidence. Do not perform 5/10/15-minute rounding.

Pay formula uses integer arithmetic:

```ts
Math.round((minutes * hourlyRateCents * multiplierBps) / (60 * 10000))
```

- [ ] **Step 4: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-attendance-core.test.mjs
git add lib/staffAttendanceCore.ts tests/staff-attendance-core.test.mjs
git commit -m "feat: add staff payroll core rules"
```

---

## Task 4: Add Super Admin employee/config APIs

**Files:**
- Create: `app/api/system/staff-employees/route.ts`
- Create: `app/api/system/staff-employees/[employeeId]/route.ts`
- Create: `app/api/system/staff-employees/[employeeId]/rate/route.ts`
- Create: `app/api/system/staff-employees/[employeeId]/employment-type/route.ts`
- Create: `app/api/system/staff-public-holidays/route.ts`
- Create: `app/api/system/staff-public-holidays/[holidayId]/route.ts`
- Create: `tests/staff-employees-api-contract.test.mjs`

**Interfaces:**
- `GET/POST /api/system/staff-employees`
- `GET/PATCH /api/system/staff-employees/:employeeId`
- `POST /api/system/staff-employees/:employeeId/rate`
- `POST /api/system/staff-employees/:employeeId/employment-type`
- `GET/POST /api/system/staff-public-holidays`
- `PATCH /api/system/staff-public-holidays/:holidayId` creates a new holiday version rather than rewriting old version rows.

- [ ] **Step 1: Write RED source/API contract tests**

Require every route to use `requireSuperAdmin`. Assert rate/type APIs accept an `effectiveFrom` date and do not update old rows. Assert holiday update inserts a version. Assert employee delete method is absent.

- [ ] **Step 2: Implement employee list/create/detail/update**

On create, require initial hourly rate, rate effective date, employment type and employment-type effective date in the same request. If any part fails, roll back/compensate so no half-configured employee is visible.

Audit actions:
- `staff.employee.created`
- `staff.employee.updated`
- `staff.employee.status_changed`
- `staff.rate.added`
- `staff.employment_type.added`
- `staff.holiday.created`
- `staff.holiday.versioned`

Use existing `writeAuditEvent()` patterns and `entity_type` values such as `staff_employee`, `staff_rate`, `staff_public_holiday`.

- [ ] **Step 3: Implement future-effective rates/types**

Reject duplicate effective-from dates for the same employee with a clear 409. Allow future dates. The current display value is resolved using Malta's current calendar date.

Never update a historical row in place. A correction to historical configuration must be a deliberate audited replacement/version procedure if later required; do not add generic destructive editing now.

- [ ] **Step 4: Implement holiday versioning**

Create holiday identity by unique date. Updating name/multipliers/status creates a new version and supersedes the previous current version. Historical payroll later points at the exact version used.

- [ ] **Step 5: Run contracts and commit**

```bash
node --experimental-strip-types --test tests/staff-employees-api-contract.test.mjs tests/staff-attendance-core.test.mjs
git add app/api/system/staff-employees app/api/system/staff-public-holidays tests/staff-employees-api-contract.test.mjs
git commit -m "feat: add staff employee and pay configuration api"
```

---

## Task 5: Add private staff-photo lifecycle

**Files:**
- Create: `app/api/system/staff-employees/[employeeId]/photo/route.ts`
- Create: `tests/staff-employee-photo-contract.test.mjs`

**Interfaces:**
- `GET` returns authenticated inline image for Super Admin.
- `POST` accepts WebP <= 5MB.

- [ ] **Step 1: Write RED contract test**

Assert private bucket name, Super Admin guard, WebP validation, 5MB cap, upload-before-record-update rollback and old-object cleanup only after successful replacement.

- [ ] **Step 2: Implement by adapting the existing member-photo lifecycle**

Use object path:

```text
employees/<employeeId>/<timestamp>-<uuid>.webp
```

Never store photos in a public bucket. Audit `staff.photo.updated` without embedding image bytes/base64 in audit JSON.

- [ ] **Step 3: Run tests and commit**

```bash
node --experimental-strip-types --test tests/staff-employee-photo-contract.test.mjs
git add app/api/system/staff-employees/[employeeId]/photo/route.ts tests/staff-employee-photo-contract.test.mjs
git commit -m "feat: add staff employee photo lifecycle"
```

---

## Task 6: Build employee and public-holiday Super Admin UI

**Files:**
- Create: `app/staff/admin/staff/page.tsx`
- Create: `components/staff/StaffEmployeesAdmin.tsx`
- Create: `components/staff/StaffEmployeeDetail.tsx`
- Create: `components/staff/StaffPublicHolidaysAdmin.tsx`
- Modify: `components/staff/SuperAdminHome.tsx`
- Create: `tests/staff-employees-ui-contract.test.mjs`

**Interfaces:**
- New Super Admin tile: **Staff**.
- Employee tabs: `Details`, `Attendance`, `Payroll`, `Audit`; Plan 01 fully implements Details/Pay Configuration and leaves attendance/payroll data panels in a non-fake empty/coming-next state until Plans 02/03.
- Staff section subnavigation exposes `Employees`, `Timesheets`, `Public Holidays`, `Punch Clock Terminals` without conflating Staff Logins.

- [ ] **Step 1: Write RED UI contracts**

Assert the form exposes name, surname, ID card, address, mobile, email, home gym, photo, active status, Full Time/Part Time, initial rate and effective dates. Assert holiday editor has two multipliers.

- [ ] **Step 2: Implement the Staff management shell and Employees UI**

Search/filter by name, home gym, active state, employment type and fingerprint status. Show current rate resolved server-side.

Employee detail displays effective-dated rate/type history chronologically and supports adding future changes.

- [ ] **Step 3: Implement Public Holidays UI**

Fields: name, date, Full Time multiplier, Part Time multiplier, active, note. Display current version plus version history. Multipliers are entered/displayed as e.g. `2.0x` but converted to/from basis points server-side.

- [ ] **Step 4: Update Super Admin home**

Add a dedicated `Staff` management card. Remove the outdated footer claiming Punch Clock will be added in a later phase. Keep existing Staff Portal logins card unchanged.

- [ ] **Step 5: Run UI contracts, TypeScript and build**

```bash
node --experimental-strip-types --test tests/staff-employees-ui-contract.test.mjs tests/staff-employees-api-contract.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/staff/admin/staff components/staff/StaffEmployeesAdmin.tsx components/staff/StaffEmployeeDetail.tsx components/staff/StaffPublicHolidaysAdmin.tsx components/staff/SuperAdminHome.tsx tests/staff-employees-ui-contract.test.mjs
git commit -m "feat: add super admin staff employment management"
```

## Plan 01 completion checkpoint

Before Plan 02:

- TEST schema exists and Production does not.
- Super Admin can create/deactivate employees, add effective-dated wages and Full Time/Part Time changes, manage separate holiday multipliers and staff photos.
- Historical rows are versioned rather than overwritten.
- Existing Staff Logins remain unchanged.
- Full unit/contract/type/build verification is green.
- No Vercel Preview has been created for routine branch pushes.