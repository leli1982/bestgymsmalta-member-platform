# Staff Payroll Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the reader-independent Staff Attendance & Payroll system onto current `main` without overwriting any work completed after Punch Clock development paused.

**Architecture:** Current `main` is the sole baseline and source of truth. Missing payroll/admin files are selectively restored from the old attendance branch, while current files receive only surgical edits. Fingerprint kiosk, terminal administration, native biometric code and Staff-facing Punch Clock activation remain excluded until the SecuGen Hamster Pro 20 hardware phase.

**Tech Stack:** Next.js, React, TypeScript, Supabase/PostgreSQL, ExcelJS, Nodemailer.

**Spec:** Existing Phase 3 attendance/payroll design and the 30 October 2026 reconciliation checkpoint.

## Global Constraints

- Preserve all current `main` Staff Portal, offline, scanner, Bar, End of Day, Help Centre, membership and Super Admin changes.
- Keep `components/staff/StaffDashboard.tsx` Punch Clock disabled.
- Enable Super Admin access to `/staff/admin/staff` only.
- Do not include FP100/native biometric implementation or terminal administration in this phase.
- Do not touch Production Supabase until explicit approval after TEST verification.
- Historical rates, employment type and holiday multipliers must remain immutable snapshots for prior payroll.
- Forgotten open sessions auto-close at Malta midnight and remain visibly flagged for Super Admin review.

## Review Focus

- Current Staff dashboard and scanner behavior remain byte-for-byte untouched by the reconciliation.
- Super Admin Staff management does not expose terminal or fingerprint controls before HU20 work begins.
- Historical payroll remains based on stored segments/snapshots after later rate or holiday changes.
- Manual punches and session corrections require reasons and remain audited.
- Midnight auto-clock-out sessions are flagged for correction rather than silently treated as normal attendance.

---

### Task 1: Reconcile Super Admin payroll management
- [x] Add missing employee, rate, employment type and public-holiday APIs/components.
- [x] Add missing attendance/timesheet reporting, correction, export, print and email code.
- [x] Restore payroll database migrations on the feature branch only.
- [x] Add the Staff management tile to the current Super Admin home with a surgical edit.
- [x] Keep Staff Punch Clock disabled and exclude terminal/fingerprint administration.
- [x] Add a contract test guarding these boundaries.

### Task 2: Verify integration
- [ ] Run repository tests, TypeScript and Next.js build through CI.
- [ ] Repair only reconciliation-specific failures; do not replace newer current-main files with old versions.
- [ ] Confirm the branch diff contains no unintended changes to later project work.

### Task 3: TEST-only functional verification
- [ ] Apply attendance/payroll migrations to TEST only after CI is green.
- [ ] Verify employee create/edit/photo, effective-dated rate and employment type.
- [ ] Verify public-holiday versioning and FT/PT multipliers.
- [ ] Verify manual attendance, corrections, audit, timesheets, print/Excel/email and historical preservation.
- [ ] Verify midnight auto-clock-out flag/correction flow.

### Task 4: Hardware phase — intentionally deferred
- [ ] Integrate SecuGen Hamster Pro 20 HU20 enrollment and identification after the physical reader arrives.
- [ ] Activate Staff Punch Clock only after reader testing and explicit approval.
