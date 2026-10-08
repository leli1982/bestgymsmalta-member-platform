# C3 Member Engagement Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, idempotent inactivity and streak notifications to the existing BestGymsMalta member Web Push stack without changing membership access or physical gym-entry rules.

**Architecture:** Extend the current VAPID/Supabase/Vercel implementation. Add server-managed member notification preferences, a globally disabled-by-default engagement settings row, a durable event log, a pure Malta-calendar engagement core, a paged daily engine, and account/admin controls. Reuse the existing push subscription store, service worker, member notification centre and secured daily cron.

**Tech Stack:** Next.js 16, TypeScript, Supabase/PostgreSQL, Vercel Cron, Web Push/VAPID, Node test runner, Playwright/Chromium browser tests.

**Spec:** `docs/superpowers/specs/2026-10-08-member-engagement-push-c3.md`

## Global Constraints

- Canonical attendance sources are `qr`, `nfc`, and `barcode` only.
- Malta calendar dates are authoritative for inactivity, streak and membership eligibility calculations.
- Motivational notifications require an active, unexpired, non-archived, non-cancelled, app-enrolled member with motivational preferences enabled.
- Existing expiry reminder behavior and physical gym-entry rules must remain unchanged.
- Streak milestones are fixed at 3, 5, 7, 14, and 30 consecutive Malta attendance dates.
- Inactivity fires once when the latest canonical attendance date is exactly 3 complete Malta calendar days behind the business date.
- Members with no canonical attendance history are skipped for inactivity.
- Global engagement settings default disabled.
- Production database migration requires separate explicit user approval after TEST verification and green CI.
- No new third-party push provider.

## Review Focus

- Multiple same-day visits count once and cannot inflate a streak.
- DST/UTC crossings must resolve to the correct Malta attendance date.
- Expired/grace/cancelled/archived members never receive motivational notifications.
- Duplicate/overlapping cron runs cannot send the same event twice.
- First Production enable must not backfill stale historical streaks; streak events are actionable only when the latest attendance date is today or yesterday in Malta.

---

### Task 1: Add C3 schema and pure engagement rules

**Files:**
- Create: `supabase/migrations/20261008203000_member_engagement_notifications.sql`
- Create: `lib/memberEngagementCore.ts`
- Create: `tests/member-engagement-core.test.mjs`

**Interfaces:**
- Produces `evaluateMotivationalEligibility(...)`, `attendanceDatesFromCheckins(...)`, `buildInactivityEvent(...)`, `buildStreakEvent(...)`, `ENGAGEMENT_STREAK_MILESTONES`.
- Creates `bgm_member_notification_preferences`, `bgm_member_engagement_settings`, and `bgm_member_engagement_notification_log`.

- [ ] Write tests for Malta-date normalization, same-day dedupe, exact 3-day inactivity, event keys, streak breaks/milestones, fresh-only streak delivery, and motivational eligibility.
- [ ] Run the focused test and confirm RED before implementation.
- [ ] Implement the pure core and additive migration.
- [ ] Run focused tests and confirm GREEN.
- [ ] Apply the migration to TEST Supabase only and verify defaults, unique constraint and RLS.

### Task 2: Generalize member push delivery without changing expiry behavior

**Files:**
- Modify: `lib/memberPushNotifications.ts`
- Modify: `tests/membership-reminders-contract.test.mjs`
- Create: `tests/member-push-delivery-contract.test.mjs`

**Interfaces:**
- Produces `sendMemberPush(memberId, payload)` returning `{status,sent,failed,subscriptions}`.
- Existing `sendMemberMembershipReminderPush(...)` remains as a wrapper.

- [ ] Write contract tests that require the generic sender and preserve 404/410 deactivation/reset behavior.
- [ ] Confirm RED.
- [ ] Refactor the sender minimally.
- [ ] Run focused expiry + push tests GREEN.

### Task 3: Add member preferences and Super Admin rollout settings APIs

**Files:**
- Create: `app/api/member/notification-preferences/route.ts`
- Create: `app/api/system/member-engagement-settings/route.ts`
- Create: `tests/member-engagement-api-contract.test.mjs`

**Interfaces:**
- Member GET/PATCH returns `{criticalEnabled,motivationalEnabled}` and scopes writes to the authenticated member session.
- Super Admin GET/PATCH returns `{enabled,inactivityEnabled,streakEnabled}` and requires `requireSuperAdmin`.

- [ ] Write auth/default/update contract tests.
- [ ] Confirm RED.
- [ ] Implement both routes with server-side Supabase access and no public table access.
- [ ] Run focused tests GREEN.

### Task 4: Add engagement engine and extend the secured daily cron

**Files:**
- Create: `lib/memberEngagementEngine.ts`
- Modify: `app/api/cron/membership-expiry-reminders/route.ts`
- Create: `tests/member-engagement-engine-contract.test.mjs`

**Interfaces:**
- Produces `runMemberEngagementNotifications(now?: Date)` returning an independent summary.
- Cron returns both expiry and engagement summaries and catches each engine independently.

- [ ] Write tests requiring paged member/check-in reads, canonical sources, eligibility filters, durable unique claims, in-app creation, generic push delivery and independent cron summaries.
- [ ] Confirm RED.
- [ ] Implement paged/chunked engine with per-member failure isolation.
- [ ] Run focused tests GREEN.

### Task 5: Upgrade member and Super Admin notification UI

**Files:**
- Modify: `components/member/MemberReminderNotifications.tsx`
- Create: `components/admin/MemberEngagementSettingsAdmin.tsx`
- Modify: `components/admin/NotificationSettingsAdmin.tsx`
- Create: `tests/member-engagement-ui-contract.test.mjs`

**Interfaces:**
- Member section becomes `App notifications`, retains device subscribe/unsubscribe/test controls, and adds critical/motivational account toggles when subscribed.
- Unsupported iOS Safari outside an installed Home Screen PWA receives explicit install guidance.
- Admin notification page adds the engagement global/inactivity/streak switches.

- [ ] Write contract tests for labels/endpoints/iOS guidance/admin control.
- [ ] Confirm RED.
- [ ] Implement UI using existing styling patterns.
- [ ] Run focused tests GREEN.

### Task 6: Browser regression coverage and full verification

**Files:**
- Create: `tests/browser/member-engagement-notifications.mjs`
- Modify: `.github/workflows/phase2-ci.yml`

**Interfaces:**
- Browser fixture verifies unsupported guidance, subscribed state, category toggles and local test button without sending real push.

- [ ] Add Chromium fixture with mocked authenticated APIs and PushManager/service-worker capability states.
- [ ] Add the browser script to Phase 2 CI.
- [ ] Run/observe full Phase 2 CI and fix only evidence-backed regressions.
- [ ] Run Supabase TEST advisors/security review and verify C3 tables are RLS-enabled and migration is additive.
- [ ] Present the exact Production migration and rollout switch behavior for explicit approval; do not migrate Production before approval.
