# App Adoption Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only App Adoption section to Super Admin Statistics & Analytics with accurate first-app-activation dates.

**Architecture:** Keep the existing large business analytics endpoint unchanged. Add one small Super Admin-only read endpoint for App Adoption, one isolated UI panel, and one additive nullable `app_enrolled_at` column. Member registration stamps that field exactly when `app_enrolled` first becomes true. Legacy enrolled members remain counted but are not assigned guessed activation dates.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase/PostgREST, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-02-app-adoption-analytics.md`

## Global Constraints
- Additive nullable schema change only; no historical backfill guesses.
- Super Admin analytics endpoint is read-only.
- Registration change is limited to recording the first activation timestamp.
- Do not alter scanner, Bar, EOD, memberships or other member-app behavior.
- Use Malta calendar dates and existing auth/date helpers.

## Review Focus
- `app_enrolled=true` with null `app_enrolled_at` must count toward adoption totals but never a daily activation.
- Expired/archived/cancelled members must not inflate the active-member adoption denominator.
- Date ranges must include zero-activation days.
- Today/week/month boundaries must use Europe/Malta, including DST.
- Existing Statistics & Analytics sections must remain available.

---

### Task 1: Pin the analytics contract
- [x] Add failing contract assertions and confirm RED before implementation.

### Task 2: Track precise first activation
**Files:**
- Add: `supabase/migrations/20261102_120000_member_app_enrolled_at.sql`
- Modify: `app/api/member/auth/register/route.ts`

- [x] Add nullable `app_enrolled_at timestamptz`.
- [x] Stamp it at the same instant registration first sets `app_enrolled=true`.
- [x] Leave historical enrolled users null rather than fabricating dates.

### Task 3: Add isolated server-side analytics
**Files:**
- Add: `app/api/system/app-adoption-analytics/route.ts`

- [x] Require Super Admin.
- [x] Calculate total/adoption KPIs from `app_enrolled`.
- [x] Calculate daily/today/week/month activations from `app_enrolled_at` using Malta day boundaries.
- [x] Paginate activation rows and include zero days in the selected range.

### Task 4: Render App Adoption under Statistics & Analytics
**Files:**
- Add: `components/staff/AppAdoptionAnalyticsAdmin.tsx`
- Modify: `components/staff/StatisticsDashboardAdmin.tsx`

- [x] Add `App Adoption` to Business analytics.
- [x] Render six headline KPIs and daily activation chart.
- [x] Clearly disclose legacy enrolled users that predate precise tracking.

### Task 5: Regression and release gate
- [ ] Run contract, TypeScript, build and full Phase 2 CI on the final branch head.
- [ ] Verify TEST database migration and preview behavior.
- [ ] Review PR diff for intended scope only.
- [ ] Merge/release only after explicit Production approval.
