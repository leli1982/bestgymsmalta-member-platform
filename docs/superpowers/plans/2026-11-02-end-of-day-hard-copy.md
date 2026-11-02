# End of Day Hard Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a printable hard-copy report immediately after a successful Staff End of Day submission without changing the existing submission/write path.

**Architecture:** Add a tiny client-side bridge mounted only on `/staff/end-of-day`. It records the submitted-state marker at mount, watches for a later false→true transition, then calls `window.print()` once and supplies print-only CSS.

**Tech Stack:** Next.js/React, TypeScript, existing Node contract tests.

**Spec:** `docs/superpowers/specs/2026-11-02-end-of-day-hard-copy-design.md`

## Global Constraints

- Do not modify the EOD API/database submission path.
- Do not print on failed submission.
- Do not auto-print an already-submitted report when reopened.
- Keep Production untouched until tests are green and merge is approved.

## Review Focus

- Existing submitted report on first render must not trigger print.
- Fresh successful submit must trigger print exactly once.
- DOM changes unrelated to submit must not print.
- Print layout must not include navigation/buttons.
- Existing End of Day contract must remain green.

---

### Task 1: Pin the hard-copy contract

**Files:**
- Create: `tests/end-of-day-print-contract.test.mjs`

- [ ] Write a failing source-contract test requiring the print bridge, submitted-state transition guard, `window.print()`, and page mount.
- [ ] Run tests and confirm RED.

### Task 2: Add print bridge

**Files:**
- Create: `components/staff/EndOfDayPrintBridge.tsx`
- Modify: `app/staff/end-of-day/page.tsx`

- [ ] Implement mount baseline + MutationObserver transition detection.
- [ ] Trigger `window.print()` only on absent→present submitted marker.
- [ ] Add print-only CSS that hides links/buttons and removes screen background/shadows.
- [ ] Mount bridge beside the existing `EndOfDayPage`.
- [ ] Run targeted EOD tests, TypeScript, build, then full CI.
