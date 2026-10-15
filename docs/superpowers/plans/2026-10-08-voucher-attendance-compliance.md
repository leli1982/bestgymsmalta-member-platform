# Voucher Attendance Compliance & Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Super Admin Voucher Analytics with accurate per-member attendance, no-show filtering, total visits, gym breakdowns, and printable/PDF-ready compliance reports based only on canonical BGM check-ins.

**Architecture:** Keep the current Voucher Analytics API/UI/print flow and add a pure attendance calculation core plus read-only joins to voucher-backed membership identities and `bgm_member_checkins`. All percentage/eligibility logic is server-derived and Malta-calendar aware; the UI only presents and filters the authoritative response.

**Tech Stack:** Next.js 16, TypeScript, React, Supabase, Node test runner, existing BGM system-auth and browser-print infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-08-voucher-attendance-compliance.md`

## Global Constraints

- Super Admin only.
- Attendance source is successful canonical BGM check-ins; no separate attendance scan.
- Malta calendar dates determine eligibility and attended days.
- Multiple visits on one day count once for attendance percentage but all count as Total Visits.
- Historical voucher eligibility must remain reportable.
- No Production DB mutation or migration in this phase.
- Payroll/punch-clock branch remains untouched.

## Review Focus

1. Malta DST boundaries: a UTC timestamp near midnight must land on the correct Malta attendance date; Task 1 tests this.
2. Cancelled memberships: cancellation effective date must not be counted as eligible; Task 2 tests this.
3. Duplicate/overlapping voucher periods: eligibility must be unioned rather than double-counted; Task 1 tests this.
4. Members enrolled before the report window: overlapping historical voucher memberships must still appear; Task 2 tests this.
5. Repeated visits and cross-gym visits: Total Visits, attended days, and gym breakdown must remain independently correct; Task 1 tests this.

---

### Task 1: Pure voucher attendance calculation

**Files:**
- Create: `lib/voucherAttendanceCore.ts`
- Modify: `tests/voucher-attendance-core.test.mjs`

**Interfaces:**
- Consumes: canonical check-ins `{ id, memberId, gymId, gymName, checkinAt }`, report `YYYY-MM-DD` bounds, eligibility intervals `{ startDate, endDate }`.
- Produces: `summariseVoucherAttendance(input)` and `voucherAttendanceStatus(input)` returning eligible/attended/missed days, percentage, total visits, last visit, gym breakdown, and attendance status.

- [x] **Step 1: Write failing behavior tests** covering same-day repeat visits, overlapping eligibility, out-of-period visits, gym breakdown, and no-show status.
- [x] **Step 2: Run CI and verify RED**. Expected failure: `voucherAttendanceCore.ts must exist before voucher attendance behavior can pass`.
- [ ] **Step 3: Implement the pure core** using calendar-day sets for union/clipping and `Europe/Malta` for check-in dates.
- [ ] **Step 4: Add/verify DST and invalid-range tests** and make the focused test file pass.
- [ ] **Step 5: Commit the green core**.

### Task 2: Server-side voucher attendance data assembly

**Files:**
- Modify: `app/api/system/voucher-analytics/route.ts`
- Test: existing/new voucher analytics tests under `tests/`

**Interfaces:**
- Consumes: existing voucher application snapshots and legacy voucher corrections, `bgm_memberships`, `bgm_membership_members`, `bgm_members`, `bgm_member_checkins`, gym names.
- Produces: existing voucher analytics response plus per-member attendance fields and voucher-level attendance summary, without removing existing response fields.

- [ ] **Step 1: Write failing route contract tests** for Super Admin authorization, canonical check-in source, member linkage, historical overlap, cancellation effective date, and complete paging/batching.
- [ ] **Step 2: Run focused tests and verify RED**.
- [ ] **Step 3: Extend the route** to resolve actual member identities and voucher eligibility intervals, query qualifying canonical check-ins, and aggregate with Task 1 core.
- [ ] **Step 4: Run focused tests and verify GREEN**.
- [ ] **Step 5: Commit API integration**.

### Task 3: Super Admin attendance UI and filters

**Files:**
- Modify: `components/staff/VoucherAnalyticsAdmin.tsx`
- Test: voucher UI contract tests under `tests/`

**Interfaces:**
- Consumes: Task 2 voucher/member attendance response.
- Produces: Super Admin list showing Attendance %, Total Visits, eligible/attended/missed days, last visit and expandable gym breakdown; All/Attended/No Show filtering; print link carrying the active filter/date/voucher selection.

- [ ] **Step 1: Write failing UI contract tests** for attendance columns, summary metrics, attendance filters, gym breakdown, and print query preservation.
- [ ] **Step 2: Run focused tests and verify RED**.
- [ ] **Step 3: Implement the UI changes** without adding client-side attendance calculations.
- [ ] **Step 4: Run focused tests and verify GREEN**.
- [ ] **Step 5: Commit UI changes**.

### Task 4: Printable/PDF-ready compliance report

**Files:**
- Modify: `app/staff/admin/statistics/vouchers/print/page.tsx`
- Modify: `components/staff/VoucherReportPrint.tsx`
- Test: voucher print tests under `tests/`

**Interfaces:**
- Consumes: the same Task 2 API plus print query parameters.
- Produces: browser-printable report matching selected voucher/date/attendance filter and displaying report basis, generated time, summary totals, per-member attendance and compact gym breakdown.

- [ ] **Step 1: Write failing print contract tests** for report metadata, attendance fields, gym breakdown, and No Show/Attended filter preservation.
- [ ] **Step 2: Run focused tests and verify RED**.
- [ ] **Step 3: Implement print/report changes** using existing browser print/PDF flow.
- [ ] **Step 4: Run focused tests and verify GREEN**.
- [ ] **Step 5: Commit print changes**.

### Task 5: Full verification and review

**Files:**
- Modify only if verification exposes a defect.

**Interfaces:**
- Consumes: complete branch.
- Produces: a review-ready PR with no Production DB changes.

- [ ] **Step 1: Run full Node test suite**: `node --experimental-strip-types --test tests/*.test.mjs` → all pass.
- [ ] **Step 2: Run TypeScript check**: `npx tsc --noEmit` → pass.
- [ ] **Step 3: Run Next.js build**: `npm run build` → pass.
- [ ] **Step 4: Run existing Chromium verification required by CI** → pass.
- [ ] **Step 5: Perform whole-branch code review** focused on authorization, historical accuracy, Malta dates and no accidental DB writes.
- [ ] **Step 6: Mark PR ready only after all required checks are green**; do not merge/deploy without the user’s explicit approval if that would affect Production.
