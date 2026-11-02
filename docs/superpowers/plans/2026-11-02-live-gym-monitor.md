# Live Gym Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Super Admin live monitor for one gym with 5-second polling and today's operational activity.

**Architecture:** A single secured server route aggregates existing scan, check-in, audit, and Bar records by gym and Malta business day. A focused client component renders counters and a capped merged feed and polls the route every five seconds. No database migrations or existing write-path changes.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, existing BGM system auth and Malta date helpers.

**Spec:** `docs/superpowers/plans/2026-11-02-live-gym-monitor-design.md`

## Global Constraints
- Super Admin only.
- Read-only; no writes or schema changes.
- Do not expose card UID or credential values.
- Do not modify scanner, Bar, EOD, membership, or offline behavior.
- Auto-refresh every 5 seconds; cap recent feed rows.

## Review Focus
- Invalid or inactive gym ID returns a safe error.
- Empty day shows zero counters and a useful empty state.
- Rejected scans never expose credential/card identifiers.
- Polling is cleaned up on unmount and does not overlap indefinitely.
- API failures keep the page usable and display a concise error.

---

### Task 1: Live monitor API contract

**Files:**
- Create: `app/api/system/live-gym-monitor/route.ts`
- Test: `tests/live-gym-monitor-contract.test.mjs`

**Interfaces:**
- Consumes: `requireSuperAdmin(request)`, `getSupabaseAdmin()`, `todayMaltaDate()`, `maltaDayUtcRange(date)`.
- Produces: GET JSON `{ gym, businessDate, summary, feed, generatedAt }` for `gymId`.

- [ ] Write failing contract tests for Super Admin auth, gym scoping, scan/check-in/audit/Bar sources, no-store response, and safe field selection.
- [ ] Run tests and confirm failure before route exists.
- [ ] Implement minimal route with capped queries and merged/sorted feed.
- [ ] Run contract tests and TypeScript.
- [ ] Commit.

### Task 2: Super Admin monitor screen

**Files:**
- Create: `components/staff/LiveGymMonitorAdmin.tsx`
- Create: `app/staff/admin/live-monitor/page.tsx`
- Modify: `components/staff/SuperAdminHome.tsx`
- Test: `tests/live-gym-monitor-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 GET endpoint.
- Produces: gym selector, LIVE indicator, summary cards, recent activity feed, manual refresh, 5-second polling.

- [ ] Extend failing test for page, tile, polling interval, selector and summary labels.
- [ ] Implement page/component using existing Super Admin styling conventions.
- [ ] Run contract tests, full tests, TypeScript, and Next.js build.
- [ ] Verify PR diff touches only monitor files plus the Super Admin tile and docs/tests.
- [ ] Deploy one final preview and smoke-check before merge.
