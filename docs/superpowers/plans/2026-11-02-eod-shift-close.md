# Shift-based End of Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-close-per-day End of Day with multiple non-overlapping shift closes and daily aggregation.

**Architecture:** Extend EOD snapshots with shift sequence/start/end timestamps, remove the gym/date uniqueness rule, and make the atomic submit RPC calculate only the interval since the previous shift. Reuse the single live Bar sheet per gym/day but clear it only after a successful atomic shift snapshot. The admin API/UI returns individual shift rows and a per-gym/day aggregate.

**Tech Stack:** Next.js/TypeScript, Supabase/Postgres PL/pgSQL, node:test.

**Spec:** `docs/superpowers/specs/2026-11-02-eod-shift-close-design.md`

## Global Constraints
- Preserve existing EOD history and audit rows.
- No double counting across shifts.
- Failed submit must not reset Bar.
- Maintain Malta business-date semantics and existing print bridge.

## Review Focus
- Two submissions on one date produce Shift 1 and Shift 2, not a conflict.
- Payments exactly at a boundary appear in only one shift.
- Bar is zero/editable after successful close.
- Historical reports without shift timestamps remain readable.
- Admin daily total equals the sum of shift totals.

### Task 1: Database shift model and atomic submit
**Files:** Create migration; Test: `tests/end-of-day-shift-contract.test.mjs`.
- [ ] Write RED contract for shift columns, non-overlapping payment window, Bar reset and multiple reports.
- [ ] Verify RED.
- [ ] Add migration that backfills historical shift sequence 1, replaces UNIQUE(gym,date) with UNIQUE(gym,date,shift_sequence), and replaces `bgm_submit_end_of_day`/`bgm_save_daily_bar_sheet` for shift behaviour.
- [ ] Apply/verify on TEST Supabase.

### Task 2: Staff and admin APIs
**Files:** Modify `app/api/system/end-of-day/route.ts`.
- [ ] Return open next-shift preview even when earlier shifts exist.
- [ ] Include shift metadata in report detail/list and daily aggregate totals in admin list.
- [ ] Verify contract and TypeScript.

### Task 3: Super Admin presentation
**Files:** Modify `components/staff/EndOfDayAdminPage.tsx`.
- [ ] Label rows Shift N and display shift start/end.
- [ ] Show combined Daily Total per gym/date while retaining individual shift rows.
- [ ] Run full CI and preview verification.