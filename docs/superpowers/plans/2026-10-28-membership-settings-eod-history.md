# Membership Settings Voucher Placement + EOD History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Put voucher reimbursement values directly beneath discount vouchers and let Super Admin filter historical End of Day reports by gym and/or exact business date.

**Architecture:** Reuse the existing VoucherReimbursementAdmin component inside MembershipSettingsAdmin, immediately before Rules & Declarations. Extend the existing End of Day admin GET endpoint with an optional `businessDate` filter and expose that through the existing Super Admin EOD page alongside the gym filter.

**Tech Stack:** Next.js, React, TypeScript, Supabase, Node test runner.

**Spec:** User-requested UI placement and EOD history filtering in chat on 28 October 2026.

## Global Constraints
- TEST branch first; Production untouched until separately approved.
- No database schema changes.
- Voucher reimbursement logic and historical snapshots must remain unchanged.
- Existing EOD detail expansion must remain unchanged.
- Gym and date filters must work independently and together.

## Review Focus
- Blank date returns all dates.
- Blank gym returns all gyms.
- Gym + date combines both filters.
- Invalid date is rejected rather than silently producing misleading results.
- Existing report-detail lookup remains unaffected.

---

### Task 1: Voucher value placement

**Files:**
- Modify: `components/staff/MembershipSettingsAdmin.tsx`
- Modify: `app/staff/membership-settings/page.tsx`
- Test: `tests/membership-settings-voucher-placement.test.mjs`

- [ ] Verify placement test fails on current layout.
- [ ] Import and render `VoucherReimbursementAdmin` after discount vouchers and before Rules & Declarations.
- [ ] Remove duplicate bottom-level rendering from page wrapper.
- [ ] Verify placement test passes.

### Task 2: End of Day history filters

**Files:**
- Modify: `app/api/system/end-of-day/route.ts`
- Modify: `components/staff/EndOfDayAdminPage.tsx`
- Create: `tests/end-of-day-admin-history-filter.test.mjs`

- [ ] Write failing contract test for optional `businessDate` plus gym/date combined filtering.
- [ ] Add strict YYYY-MM-DD validation and query filtering in Super Admin GET.
- [ ] Add exact-date input, keep gym selector, and load with both optional filters.
- [ ] Add clear-filters action.
- [ ] Verify focused tests and full suite.
