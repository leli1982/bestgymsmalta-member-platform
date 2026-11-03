# Legacy Member App Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let legacy members activate the existing member app using their old PKCustomer number without staff assistance.

**Architecture:** Add a dedicated legacy activation API that resolves an existing `bgm_members` row using legacy PK plus identity evidence, then reuses the same username/password/session behavior as normal activation. Add a legacy mode to the current member login/activation page; no new table or migration is required.

**Tech Stack:** Next.js App Router, React, Supabase JS, bcryptjs, existing member session cookie.

**Spec:** `docs/superpowers/specs/2026-11-03-legacy-member-app-activation-design.md`

## Global Constraints
- Normal BGM-number activation must remain unchanged.
- Never create a duplicate member row.
- Never expose a BGM number before successful activation.
- Legacy PK is not assumed unique.
- Missing stored email requires exact DOB plus normalized stored mobile/phone match.
- Development and data checks remain TEST-only until Production approval.

## Review Focus
- Duplicate legacy PK rows must not activate the wrong person.
- Email comparison must be case-insensitive and trimmed.
- Phone formatting differences must normalize safely without accepting short/partial matches.
- Already-enrolled and inactive members must keep current protections.
- Username collision must still fail without partially updating the member.

---

### Task 1: Legacy identity resolution core

**Files:**
- Create: `lib/legacyMemberActivationCore.ts`
- Create: `tests/legacy-member-activation-core.test.mjs`

**Interfaces:**
- Consumes: legacy candidate rows from `bgm_members`.
- Produces: normalization helpers and a deterministic candidate resolver used by the API route.

- [ ] Write failing tests for stored-email match, no-email DOB+phone match, duplicate/ambiguous PK, phone normalization, and mismatches.
- [ ] Run the focused test and confirm RED.
- [ ] Implement the minimal resolver.
- [ ] Run the focused test and confirm GREEN.
- [ ] Commit.

### Task 2: Legacy activation API

**Files:**
- Create: `app/api/member/auth/legacy-register/route.ts`
- Create: `tests/legacy-member-activation-contract.test.mjs`

**Interfaces:**
- Consumes: `{ legacyPk, email, username, password, dateOfBirth?, mobile? }`.
- Produces: normal authenticated member response/session or a safe error; may return `needsIdentityCheck: true` when a unique no-email candidate needs DOB/mobile.

- [ ] Write failing contract tests for lookup by `legacy_pk_customer`, no duplicate insert, active/enrolled checks, identity-check response, verified email update, password hashing, and session cookie.
- [ ] Run focused tests and confirm RED.
- [ ] Implement route using Task 1 resolver and existing registration/session conventions.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit.

### Task 3: Member activation UI

**Files:**
- Modify: `components/member-auth/MemberLoginPage.tsx`
- Create: `tests/legacy-member-activation-ui-contract.test.mjs`

**Interfaces:**
- Consumes: new `/api/member/auth/legacy-register` endpoint.
- Produces: legacy activation mode and conditional DOB/mobile verification fields.

- [ ] Write failing UI contract tests for the legacy option, old PK field, API call, conditional DOB/mobile fields, and successful member/session handling.
- [ ] Run focused test and confirm RED.
- [ ] Implement the minimal UI while preserving normal login/activation/forgot-password flows.
- [ ] Run focused test and confirm GREEN.
- [ ] Commit.

### Task 4: TEST verification and full regression

**Files:**
- No schema migration.
- Add browser test only if existing member-auth browser coverage can exercise the new mode without Production data.

- [ ] Query TEST to confirm suitable fictional/test legacy records or create no persistent data if not needed.
- [ ] Verify candidate-resolution assumptions against TEST schema/data shape without exposing real member details.
- [ ] Run all unit/contract tests, `npx tsc --noEmit`, production build, and existing CI/browser suite.
- [ ] Open a draft PR from `feature/legacy-member-app-activation` to `main`.
- [ ] Do not merge or roll out to Production until explicit approval.
