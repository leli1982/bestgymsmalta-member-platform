# Automatic End of Day Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create a final End of Day submission at 23:46 Malta time for active gyms that had no EOD submission between 22:30 and 23:45.

**Architecture:** Reuse the existing EOD calculation/close function behind a service-only database wrapper, add explicit submission-source metadata, and trigger it from an authenticated Vercel Cron route. The cron is DST-safe by firing at both possible UTC equivalents while the route verifies Malta local time before acting.

**Tech Stack:** Next.js 16, TypeScript, Supabase/Postgres, Vercel Cron, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-03-automatic-end-of-day-design.md`

## Global Constraints
- Malta timezone is authoritative.
- Window is 22:30 inclusive to 23:46 exclusive.
- Trigger time is 23:46 Malta time.
- Automatic reports use source `system` and label `Automatic — System Submission`.
- Manual Staff EOD remains source `staff`.
- Active gyms only.
- Reuse existing EOD totals/Bar/shift logic.
- No Production database changes before TEST verification and explicit merge approval.

## Review Focus
- DST: exactly one of the two UTC cron invocations acts at Malta 23:46.
- Race: a 23:45 Staff submission prevents automatic close.
- Duplicate cron invocation does not create a second automatic report.
- Earlier shifts do not suppress the fallback unless a submission exists in the 22:30–23:45 window.
- Automatic reports are visually obvious in Super Admin history/detail.

---

### Task 1: Lock the automatic EOD contract
**Files:**
- Create: `tests/automatic-end-of-day-contract.test.mjs`

- [ ] Write failing source-contract tests for cron schedule, Malta-time guard, source metadata, database window/race guards and admin display.
- [ ] Run the test and confirm RED because the feature does not yet exist.

### Task 2: Add database source metadata and automatic submit RPC
**Files:**
- Create: `supabase/migrations/20261103_124500_automatic_end_of_day.sql`

- [ ] Add `submission_source` (`staff`/`system`) with historical default `staff`.
- [ ] Introduce a source-aware EOD submit implementation while retaining the current 5-argument Staff RPC contract.
- [ ] Add service-only `bgm_auto_submit_missing_end_of_day(p_now timestamptz)` that checks Malta 23:46, active gyms, 22:30–23:46 report existence, advisory locking and calls the source-aware submit path.
- [ ] Ensure automatic audit rows clearly identify system submission.

### Task 3: Add DST-safe cron route and schedule
**Files:**
- Create: `app/api/cron/automatic-end-of-day/route.ts`
- Modify: `vercel.json`
- Create: `lib/automaticEndOfDayCore.ts`

- [ ] Add pure Malta-time helper and tests/source contract.
- [ ] Add `CRON_SECRET` protected route.
- [ ] Route returns a harmless skipped response outside Malta 23:46.
- [ ] Route invokes `bgm_auto_submit_missing_end_of_day` at Malta 23:46.
- [ ] Schedule one Vercel cron expression at both possible UTC equivalents: `46 21,22 * * *`.

### Task 4: Show automatic source in Super Admin
**Files:**
- Modify: `app/api/system/end-of-day/route.ts`
- Modify: `components/staff/EndOfDayAdminPage.tsx`

- [ ] Include `submissionSource` in report list/detail API mappings.
- [ ] Render an obvious `Automatic — System Submission` badge/label for `system` reports while retaining Staff name for manual reports.

### Task 5: Verify TEST then prepare PR
- [ ] Run targeted contract test.
- [ ] Run full test suite, TypeScript and production build through CI.
- [ ] Apply migration to TEST Supabase only.
- [ ] Verify schema/function and a safe dry/no-op invocation outside 23:46.
- [ ] Enable one preview deployment for final browser verification.
- [ ] Open PR against `main`; do not merge until explicitly approved.
