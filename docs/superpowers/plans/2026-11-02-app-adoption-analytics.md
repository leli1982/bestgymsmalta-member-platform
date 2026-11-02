# App Adoption Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only App Adoption section to Super Admin Statistics & Analytics using existing member app-enrollment data.

**Architecture:** Extend the existing Super Admin business analytics API response with an `appAdoption` payload derived from `bgm_members`, then render that payload as one additional section in the existing button-driven Statistics & Analytics UI. Keep all calculations server-side and all UI read-only.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase/PostgREST, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-02-app-adoption-analytics.md`

## Global Constraints
- No database migration or writes.
- Super Admin only.
- Do not alter enrollment, scanner, Bar, EOD, membership or member-app behavior.
- Use Malta calendar dates and existing analytics endpoint/auth patterns.

## Review Focus
- `app_enrolled=true` with a null enrollment date must not fabricate a daily activation.
- Expired/archived/cancelled members must not inflate the active-member adoption denominator.
- Date ranges must include zero-activation days.
- Today/week/month KPI boundaries must use Malta calendar dates.
- Existing Statistics & Analytics sections must remain available.

---

### Task 1: Pin the analytics contract

**Files:**
- Modify: `tests/business-analytics-contract.test.mjs`

**Interfaces:**
- Produces: contract assertions for `appAdoption`, daily activations and the `App Adoption` dashboard option.

- [ ] Add failing assertions for the new API payload and dashboard option.
- [ ] Run `node --test tests/business-analytics-contract.test.mjs` and confirm RED for the missing feature.
- [ ] Commit the RED test.

### Task 2: Add server-side app adoption analytics

**Files:**
- Modify: `app/api/system/business-analytics/route.ts`

**Interfaces:**
- Produces: `appAdoption` with `totalEnrolled`, `activeMembers`, `activeEnrolled`, `adoptionPct`, `notEnrolledActive`, `activatedToday`, `activatedThisWeek`, `activatedThisMonth`, and `daily`.

- [ ] Extend the existing member selection with app enrollment fields.
- [ ] Calculate active-member adoption KPIs and daily activation buckets for the selected range, including zero days.
- [ ] Run the contract test and TypeScript checks.
- [ ] Commit.

### Task 3: Render App Adoption under Statistics & Analytics

**Files:**
- Modify: `components/staff/StatisticsDashboardAdmin.tsx`
- Modify: `components/staff/BusinessAnalyticsAdmin.tsx`

**Interfaces:**
- Consumes: `appAdoption` from the business analytics API.
- Produces: `App Adoption` selector plus KPI cards and daily activation visualization.

- [ ] Add `app-adoption` to the section/view types and Business analytics selector.
- [ ] Render KPIs and daily activation trend using existing date/gym filters and analytics styling.
- [ ] Run contract, TypeScript and production build checks.
- [ ] Commit.

### Task 4: Regression and release gate

**Files:** no functional changes expected.

- [ ] Run the full existing Phase 2 CI/regression suite on the branch.
- [ ] Review the branch diff for analytics-only scope.
- [ ] Open PR and merge only after all checks are green.
