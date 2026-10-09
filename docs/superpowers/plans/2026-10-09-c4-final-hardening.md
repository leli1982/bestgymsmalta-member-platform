# C4 Final Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining C4 TEST/repository drift and prove the Google Wallet branch is safe and release-ready without changing Production Wallet configuration or merging the PR.

**Architecture:** Reproduce the already-validated TEST repair for `public.bgm_super_admin_update_member_profile` as an idempotent migration, protected by a focused contract regression. Then verify TEST database security/state and run exact-HEAD CI and PR audits. The Wallet implementation and object model are unchanged.

**Tech Stack:** Next.js 16, Node.js tests, PostgreSQL/Supabase, GitHub Actions, Google Wallet Generic Pass.

**Spec:** `docs/google-wallet-test-rollout.md`

## Global Constraints

- TEST Supabase only for C4 migrations and fixture verification: `vlvyqdjhzdcxatilbdiv`.
- Production Supabase `jsuolemirhivqhjbjetv` remains untouched except changes explicitly approved by the owner.
- Do not add Production Wallet environment variables, issue a real-member Wallet pass, merge PR #39, or run a Production Wallet migration without explicit owner approval.
- Preserve `SECURITY DEFINER`, `SET search_path = ''`, revokes from `public`, `anon`, `authenticated`, and execute grant to `service_role` on the Super Admin profile RPC.
- No fixture UUIDs or fictional-member data in migrations.
- Google Wallet recovery must remain non-provisioning for pending/failed recovery and BGM remains authoritative for access.

## Review Focus

- PostgreSQL set-returning-function aliases must expose a named scalar column before referencing `.key`.
- The profile RPC must retain all current validation, optimistic concurrency, update, and audit behavior.
- The repair must not widen RPC execution privileges.
- TEST Wallet mappings must remain limited to the intended fictional member and contain no pending/failed rows after recovery validation.
- Final CI must be green on the exact PR head that is reviewed.

---

### Task 1: Codify the Super Admin profile RPC repair

**Files:**
- Create: `supabase/migrations/20261009_203000_super_admin_profile_json_key_alias_fix.sql`
- Create: `tests/super-admin-profile-json-key-alias-fix.test.mjs`

**Interfaces:**
- Consumes: existing `public.bgm_super_admin_update_member_profile(uuid,uuid,timestamptz,jsonb)` contract.
- Produces: same RPC signature and behavior with valid `jsonb_object_keys(p_profile) as k(key)` aliasing.

- [ ] **Step 1: Write the failing contract test**

Assert the new migration exists, contains `jsonb_object_keys(p_profile) as k(key)`, does not contain the broken `jsonb_object_keys(p_profile) k where ... k.key` form, preserves `SECURITY DEFINER` and `SET search_path = ''`, revokes execution from `public`, `anon`, `authenticated`, and grants execute to `service_role`.

- [ ] **Step 2: Run the test to verify RED**

Run the repository test command for `tests/super-admin-profile-json-key-alias-fix.test.mjs` through PR CI. Expected: FAIL because the migration does not yet exist.

- [ ] **Step 3: Add the minimal migration**

Recreate the current profile RPC with its existing validation/update/audit body and only the scalar alias correction required for PostgreSQL compatibility. Reapply the existing revoke/grant statements.

- [ ] **Step 4: Run CI to verify GREEN**

Expected: the focused test and the complete Phase 2 CI suite pass.

- [ ] **Step 5: Apply and verify on TEST**

Apply the migration to TEST Supabase only. Verify the stored function definition contains `as k(key)`, remains `SECURITY DEFINER`, has an empty search path, and has no execute privilege for `public`, `anon`, or `authenticated` while `service_role` can execute.

### Task 2: Final C4 TEST and release gates

**Files:**
- No product-code changes unless a verification failure identifies a defect.

**Interfaces:**
- Consumes: C4 Wallet mapping/recovery tables, PR #39, exact branch HEAD.
- Produces: release-gate evidence; no merge or Production Wallet activation.

- [ ] **Step 1: Verify TEST Wallet state**

Confirm only the intended fictional C4 member has a Wallet mapping, mapping count is one, status is `synced`, no pending/failed mapping remains, and the member is active with one active physical card and expiry `2028-01-31`.

- [ ] **Step 2: Verify database security**

Check RLS and grants for `bgm_google_wallet_passes` plus the repaired profile RPC. Run available Supabase security/performance advisor checks and investigate any C4-relevant findings.

- [ ] **Step 3: Audit PR #39**

Review changed files/patch for credentials, TEST fixture identifiers, Production Wallet configuration, accidental reminder-test artifacts, and unrelated changes. Confirm PR remains draft/open/unmerged.

- [ ] **Step 4: Verify exact-HEAD CI**

Confirm all required checks are green for the same HEAD SHA reviewed in Step 3.

- [ ] **Step 5: Stop at the Production gate**

Present the exact Production migrations/environment variables/deployment/merge actions still required and wait for explicit owner approval before performing any of them.
