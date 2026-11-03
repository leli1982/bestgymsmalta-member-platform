# EOD Cross-Midnight Carry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure End of Day resets only on an actual EOD submission, never at midnight.

**Architecture:** Preserve the existing EOD calculation and reporting model. Replace calendar-day scoping with a financial window from the previous EOD `shift_ended_at` to the next EOD submission, and keep one live Bar working sheet across midnight until EOD clears it.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, Node test contracts.

**Spec:** `docs/superpowers/specs/2026-11-03-eod-cross-midnight-carry-design.md`

## Global Constraints
- Keep existing New Membership, Renewal, Voucher, Bar, Expense, Gross and Final Total calculations unchanged.
- Midnight alone must not clear or restart any EOD figure.
- No automatic EOD submission.
- TEST Supabase before Production.
- Do not touch Production without a separate approval checkpoint.

## Review Focus
- Previous EOD before midnight, next EOD after midnight: late sales must be included once.
- Multiple EOD submissions on the same date: no double counting.
- Bar sheet crossing midnight: quantities/totals persist until EOD.
- First-ever EOD: use current Malta-day start fallback.
- Voucher reimbursement remains attached to the same membership window as before.

---

### Task 1: Pin the cross-midnight contract
**Files:**
- Create: `tests/end-of-day-cross-midnight.test.mjs`

- [ ] Write source-contract tests for cross-midnight payment windows, Bar persistence, preview carry-forward and unchanged categories.
- [ ] Run the test and confirm RED because the migration/route changes do not yet exist.

### Task 2: Make EOD submission window timestamp-based
**Files:**
- Create: `supabase/migrations/20261103_160000_eod_cross_midnight_carry.sql`

- [ ] Replace same-business-date previous-shift lookup with latest gym EOD timestamp across dates.
- [ ] Preserve current-date `shift_sequence` numbering.
- [ ] Remove `payment_business_date = p_business_date` from membership and voucher aggregation.
- [ ] Keep the exact existing category calculations and snapshot/reset transaction.
- [ ] Resolve the Bar working row by latest row for the gym, not calendar date.

### Task 3: Make Staff preview and Bar API use the open financial shift
**Files:**
- Modify: `app/api/system/end-of-day/route.ts`
- Modify: `app/api/system/bar/today/route.ts`

- [ ] Staff preview finds latest EOD across all dates.
- [ ] Preview queries memberships from the Malta date containing the previous EOD onward, then applies the exact timestamp cutoff.
- [ ] Bar GET/PUT resolves the latest working Bar row across dates.
- [ ] Keep the UI response structure unchanged.

### Task 4: Verify on TEST
- [ ] Run contract suite/build.
- [ ] Apply migration to TEST Supabase only.
- [ ] Verify a cross-midnight scenario with read-only/controlled TEST data.
- [ ] Open PR with Production untouched.
