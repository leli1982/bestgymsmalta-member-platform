# Staff Manual + Live Help Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh regular Staff training/help so it matches current Production behaviour for Single Gym access and EOD periods that carry across midnight.

**Architecture:** Keep `lib/staffHelpContent.ts` as the single source for both the full manual and floating Help Centre. Update only staff-facing wording in Bar/EOD pages where “today” now conflicts with the financial-shift model.

**Tech Stack:** Next.js, React, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-03-staff-manual-help-refresh-design.md`

## Global Constraints
- No behaviour or database changes.
- No Punch Clock instructions until hardware workflow release.
- No Super Admin help changes.
- Both manual and popup must continue to use the same shared content.

## Review Focus
- Single Gym member presented at wrong gym: help must say access is denied.
- Offline cached scan: help must not imply a live check-in was recorded.
- Midnight without EOD: help/UI must say figures continue.
- Successful EOD: help must say Bar/open financial period resets then.
- Sales after an EOD: help must say they belong to the next EOD.

---

### Task 1: Lock current help requirements in tests

**Files:**
- Modify: `tests/staff-help-content.test.mjs`

- [ ] Add failing assertions for Single Gym/All Access wording, cross-midnight carry, EOD-only reset, and no misleading “locks that day’s Bar sheet” rule.
- [ ] Add failing assertions that Bar/EOD staff pages no longer describe the financial period as “today”.
- [ ] Run `node --test tests/staff-help-content.test.mjs` and confirm RED.

### Task 2: Refresh shared manual/help content

**Files:**
- Modify: `lib/staffHelpContent.ts`

- [ ] Add a searchable All Access / Single Gym topic.
- [ ] Update scan, find-member, new-member, waiting-application and renewal instructions for access scope.
- [ ] Update Bar wording to “since last End of Day” and explain overnight carry.
- [ ] Update EOD wording to previous-EOD → next-EOD financial window and mention hard-copy printing.
- [ ] Run `node --test tests/staff-help-content.test.mjs` and confirm GREEN.

### Task 3: Align Staff Bar and EOD screen copy

**Files:**
- Modify: `components/staff/BarSalesPage.tsx`
- Modify: `components/staff/EndOfDayPage.tsx`

- [ ] Replace misleading “today/live daily sheet” labels with open-shift / since-last-EOD wording.
- [ ] Keep all calculations, API calls and state behaviour unchanged.
- [ ] Run the help-content test, TypeScript check and production build.

### Task 4: Final verification and review

- [ ] Run the complete repository verification workflow on the feature branch.
- [ ] Confirm no database migrations or production data changes are part of the branch.
- [ ] Open a draft PR for review; do not merge without explicit approval.
