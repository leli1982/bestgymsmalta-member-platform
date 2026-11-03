# Neptunes-only Access Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit Neptunes-only access and enforce it consistently across staffed online and offline access paths.

**Architecture:** Add `access_scope` to members/applications with `network` as the safe default and migrate only verified real-import `NO%` legacy members. Extend shared access evaluators with optional gym context, then pass scope through barcode/NFC routes and the offline roster. New Neptunes enrollments may explicitly select the restricted scope; renewals preserve member scope.

**Tech Stack:** Next.js/TypeScript, Supabase/Postgres, node:test.

**Spec:** `docs/superpowers/specs/2026-11-02-neptunes-only-access-design.md`

## Global Constraints
- `bgm-neptunes` is the only allowed gym for `neptunes_only`.
- Voucher/discount values do not control access.
- Network remains default for all other members.
- Preserve scanner conflicts, photo warnings, cards and check-ins.

## Review Focus
- Active Neptunes-only member at Neptunes => granted.
- Same member at any other gym => `restricted_gym`, no canonical check-in.
- Expired Neptunes-only member => expired, not restricted.
- Offline roster exposes scope so staff cannot mistake restricted members for network members.
- Only real-import `NO%` members are bulk migrated.

### Task 1: Schema and legacy migration
**Files:** Create migration; Test: `tests/neptunes-access-scope.test.mjs`.
- [ ] RED contract requires member/application access scope and `restricted_gym` scan result.
- [ ] Migration adds constrained defaults and updates real-import `NO%` members only.
- [ ] Apply/verify on TEST.

### Task 2: Access evaluators and staffed scan APIs
**Files:** Modify `lib/barcodeAccessCore.ts`, `lib/nfcAccessCore.ts`, barcode/NFC scan routes.
- [ ] Add optional scope/gym evaluation without changing callers that only classify membership state.
- [ ] Record `restricted_gym` and do not create a check-in when denied.
- [ ] Add scanner heading/copy.

### Task 3: Offline roster continuity
**Files:** Modify offline roster API/core and Staff global scanner.
- [ ] Carry `accessScope` in cached roster.
- [ ] Warn explicitly when an offline lookup is Neptunes-only at another gym.

### Task 4: Future Neptunes-only enrollment
**Files:** Modify enrollment application creation/review/activation path and Neptunes enrollment UI as required by existing flow.
- [ ] Neptunes staff can explicitly choose restricted scope on a new membership.
- [ ] Non-Neptunes staff cannot create it.
- [ ] Renewal preserves existing scope.
- [ ] Run full CI and preview verification.