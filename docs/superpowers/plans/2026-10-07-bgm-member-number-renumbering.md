# BGM Member Number Renumbering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every current permanent member number with a continuous `BGM1000`-up sequence, preserve UUID/pkCustomer/Scan3/member relationships, remove obsolete old-format BGM identities, reset disposable test activity, and keep future allocation variable-width with no leading zeros.

**Architecture:** Keep the member UUID as the canonical identity and change only the public `member_number`. A single controlled PostgreSQL migration builds a temporary deterministic old-rank→new-number map, temporarily disables the current immutability trigger, renumbers all members, rewrites linked import/review snapshots through member UUIDs, resets agreed test-only activity in foreign-key-safe order, updates the allocator/constraint/trigger, then verifies invariants before commit. Application validation is centralized in `lib/memberNumberCore.ts` and all fixed-seven-digit runtime checks are removed in favor of the canonical `BGM` + integer >= 1000 format.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Supabase/PostgreSQL, GitHub Actions, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-10-07-bgm-member-number-renumbering-design.md`

## Global Constraints

- TEST Supabase only during implementation/rehearsal: `vlvyqdjhzdcxatilbdiv`.
- Production Supabase `jsuolemirhivqhjbjetv` is untouched until separate explicit Production approval.
- Permanent public format is `BGM` followed by a canonical decimal integer >= 1000, with no leading zeros and no fixed width.
- All members receive a new number, regardless of status.
- Assignment order is current BGM numeric value ascending, UUID ascending as deterministic tiebreaker.
- No persistent old→new alias or mapping table is created.
- Member UUIDs, `legacy_pk_customer`, Scan3/physical-card credentials, photos, membership status/expiry and membership ownership must remain unchanged.
- Shared/duplicate Scan3 behavior remains unchanged.
- Old BGM snapshots in import/review history are rewritten to the new current BGM number through the linked member UUID; old BGM values must not remain.
- Existing app-enrolled TEST member `BGM0000007` is expected to become `BGM1003` if the preflight state has not drifted.
- Disposable TEST activity is cleared, but member master/source data is preserved.
- Do not expose or change Supabase service-role secrets.
- No Production merge/deploy/migration is part of this plan.

## Review Focus

- **Canonical format edge cases:** reject `BGM999`, `BGM01000`, `BGM0001000`, signs/decimals/spaces inside the number, while accepting `BGM1000`, `BGM10000`, and arbitrarily longer canonical digit strings within PostgreSQL `bigint` capacity.
- **Large-number handling:** validation must not silently truncate identifiers above JavaScript `Number.MAX_SAFE_INTEGER`; use string/bigint-safe parsing rather than ordinary `Number` arithmetic.
- **Migration atomicity/drift:** abort before mutation if TEST preflight expectations changed materially or if generated mapping count/uniqueness/continuity checks fail.
- **Identifier independence:** pkCustomer and Scan3/card values must remain attached to exactly the same UUIDs, including duplicate/shared Scan3 cases.
- **Cleanup ordering/provenance:** delete `bgm_card_conflict_flags` before `bgm_access_scans`, and rewrite old BGM snapshots by UUID instead of discarding pkCustomer/Scan3/source provenance.

---

## File Structure

- Modify `lib/memberNumberCore.ts` — canonical variable-width BGM validation/formatting helpers.
- Modify `tests/member-number-core.test.mjs` — pure helper behavior and edge cases.
- Modify `app/api/member/card/route.ts` — remove inline seven-digit validation.
- Modify `app/api/system/admin/members/[memberId]/delete/route.ts` — use centralized canonical BGM validation.
- Modify `lib/memberImportServer.ts` — use centralized canonical BGM validation instead of fixed regex.
- Modify existing runtime callers only where a fixed-width assumption exists; do not refactor unrelated behavior.
- Create `tests/phase-b-member-number-runtime-contract.test.mjs` — static contract checks for runtime routes/import code.
- Create `tests/phase-b-member-number-migration.test.mjs` — schema/data-migration contract checks.
- Create migration with `supabase migration new phase_b_member_number_renumbering`; refer to the CLI-generated file below as `$PHASE_B_MIGRATION`.
- Do not edit historical migrations to change already-applied behavior; the new migration supersedes their active database objects.

---

### Task 1: Canonical Member Number Core

**Files:**
- Modify: `lib/memberNumberCore.ts`
- Modify: `tests/member-number-core.test.mjs`

**Interfaces:**
- Produces: `MEMBERSHIP_NUMBER_PATTERN` matching canonical `BGM` + integer >= 1000 with no leading zero.
- Produces: `normalizeMembershipNumber(value: unknown): string` unchanged in purpose.
- Produces: `parseMembershipNumber(value: unknown): string | null`, returning the canonical numeric portion as a digit string rather than a JavaScript number.
- Produces: `formatMembershipNumber(value: number | bigint): string`, accepting safe integer numbers or bigint values >= 1000 and returning an unpadded BGM string.

- [ ] **Step 1: Rewrite the core tests to RED for the new format**

Update `tests/member-number-core.test.mjs` so it asserts:

```js
assert.equal(formatMembershipNumber(1000), "BGM1000");
assert.equal(formatMembershipNumber(9999), "BGM9999");
assert.equal(formatMembershipNumber(10000), "BGM10000");
assert.equal(formatMembershipNumber(10_000_000n), "BGM10000000");

assert.equal(parseMembershipNumber("BGM1000"), "1000");
assert.equal(parseMembershipNumber("BGM10000"), "10000");
assert.equal(parseMembershipNumber("BGM999"), null);
assert.equal(parseMembershipNumber("BGM01000"), null);
assert.equal(parseMembershipNumber("BGM0001000"), null);
assert.equal(parseMembershipNumber("1000"), null);
assert.equal(parseMembershipNumber("BGM1000.5"), null);

assert.equal(normalizeMembershipNumber(" bgm1003 "), "BGM1003");
assert.throws(() => formatMembershipNumber(999));
assert.throws(() => formatMembershipNumber(1000.5));
assert.throws(() => formatMembershipNumber(Number.MAX_SAFE_INTEGER + 1));
```

Add a bigint assertion above `Number.MAX_SAFE_INTEGER` to prove no digit-width ceiling is introduced.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/member-number-core.test.mjs
```

Expected: failures showing old zero-padding/fixed-width behavior.

- [ ] **Step 3: Implement the canonical helpers**

In `lib/memberNumberCore.ts`:
- define the canonical regex equivalent to `^BGM([1-9][0-9]{3,})$`;
- make `parseMembershipNumber` return the captured digit string or `null` without converting through `Number`;
- make `formatMembershipNumber(value: number | bigint)` reject unsafe/non-integer numbers, accept bigint, enforce `>= 1000`, and concatenate without padding;
- preserve uppercase/trim normalization behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/member-number-core.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/memberNumberCore.ts tests/member-number-core.test.mjs
git commit -m "feat: adopt variable-width BGM member numbers"
```

---

### Task 2: Remove Runtime Fixed-Width Assumptions

**Files:**
- Modify: `app/api/member/card/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/delete/route.ts`
- Modify: `lib/memberImportServer.ts`
- Verify/no functional rewrite expected: `app/api/member/auth/login/route.ts`
- Verify/no functional rewrite expected: `app/api/admin/members/route.ts`
- Verify/no functional rewrite expected: `app/api/system/members/search/route.ts`
- Verify/no functional rewrite expected: `app/api/system/barcode/scan/route.ts`
- Create: `tests/phase-b-member-number-runtime-contract.test.mjs`
- Modify: `tests/permanent-member-number-card-barcode-contract.test.mjs`

**Interfaces:**
- Consumes: `MEMBERSHIP_NUMBER_PATTERN`, `normalizeMembershipNumber`, `parseMembershipNumber` from Task 1.
- Produces: all application member-number validation routed through the canonical helper/pattern; pkCustomer and Scan3 lookup ordering remains unchanged.

- [ ] **Step 1: Write RED runtime contract tests**

Create `tests/phase-b-member-number-runtime-contract.test.mjs` to assert:
- `app/api/member/card/route.ts` imports/uses canonical member-number validation and no longer contains `^BGM[0-9]{7}$`;
- permanent-delete confirmation uses the canonical helper/pattern and no fixed-seven-digit regex;
- `lib/memberImportServer.ts` uses canonical validation and no fixed-seven-digit regex;
- login, Admin member create/search, Staff search and barcode scan still use the shared normalization/parsing path where applicable;
- barcode scan still resolves in the existing order: legacy Scan3 claims/physical credential, permanent member number, then non-unique `legacy_pk_customer` fallback;
- no Phase B runtime file writes BGM numbers into physical-card credential values.

Update `tests/permanent-member-number-card-barcode-contract.test.mjs` so historical migration assertions are not incorrectly used to define the new active format. Keep the pkCustomer/Scan3 independence assertions unchanged.

- [ ] **Step 2: Run the runtime contract tests and verify RED**

Run:

```bash
node --test tests/phase-b-member-number-runtime-contract.test.mjs tests/permanent-member-number-card-barcode-contract.test.mjs
```

Expected: failures on inline seven-digit validators and old contract expectations.

- [ ] **Step 3: Replace fixed-width validation minimally**

- `app/api/member/card/route.ts`: import the shared helper/pattern and validate the loaded permanent member number canonically.
- `app/api/system/admin/members/[memberId]/delete/route.ts`: replace inline `/^BGM[0-9]{7}$/` with canonical validation while preserving exact confirmation semantics.
- `lib/memberImportServer.ts`: replace inline fixed-width checks with the shared canonical parser/pattern.
- Do not change login/password policy, physical-card precedence, legacy pkCustomer resolution, duplicate Scan3 behavior, member status logic, or import deduplication rules.

- [ ] **Step 4: Search the live codebase for remaining active fixed-width assumptions**

Run a repository search for:

```text
BGM[0-9]{7}
\d{7}
BGM000
9999999
lpad
```

Historical migrations/docs may contain old behavior; active application/runtime code and new tests must not rely on it. Add any active caller discovered to this task rather than editing historical migrations.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
node --test tests/member-number-core.test.mjs tests/phase-b-member-number-runtime-contract.test.mjs tests/permanent-member-number-card-barcode-contract.test.mjs
npm run build
```

Expected: tests PASS and Next.js build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/api/member/card/route.ts app/api/system/admin/members/[memberId]/delete/route.ts lib/memberImportServer.ts tests/phase-b-member-number-runtime-contract.test.mjs tests/permanent-member-number-card-barcode-contract.test.mjs
git commit -m "refactor: centralize BGM number validation"
```

---

### Task 3: Build the Atomic Phase B Database Migration

**Files:**
- Create via Supabase CLI: `$PHASE_B_MIGRATION` using `supabase migration new phase_b_member_number_renumbering`
- Create: `tests/phase-b-member-number-migration.test.mjs`

**Interfaces:**
- Consumes: existing tables `bgm_members`, `bgm_member_number_state`, `bgm_member_import_rows`, `bgm_member_import_review_items`, operational test-history tables, and the existing `bgm_enforce_permanent_member_number` trigger/function.
- Produces: canonical database constraint/allocator/immutability guard and one-time deterministic renumbering/cleanup.

- [ ] **Step 1: Create the migration file with the Supabase CLI**

In the isolated execution worktree, run:

```bash
supabase migration new phase_b_member_number_renumbering
```

Capture the generated path as `$PHASE_B_MIGRATION`. Do not invent a filename manually.

- [ ] **Step 2: Write RED migration contract tests**

Create `tests/phase-b-member-number-migration.test.mjs` and point it at `$PHASE_B_MIGRATION`. Assert the migration contains all of these contract elements:
- deterministic rank ordered by numeric value of old seven-digit BGM number, then UUID;
- new value `1000 + row_number - 1` rendered as unpadded `BGM` text;
- a temporary/CTE mapping only, with no persistent alias table;
- controlled drop/disable of the current member-number immutability trigger before bulk update and recreation afterward;
- replacement format check equivalent to `^BGM[1-9][0-9]{3,}$`;
- allocator function concatenates `BGM` with numeric state and contains no `lpad`;
- state-table range constraint no longer caps at `9999999`;
- snapshot rewrites join by member UUID for `bgm_member_import_rows.resolved_membership_number` and `bgm_member_import_review_items.member_number`;
- cleanup order removes `bgm_card_conflict_flags` before `bgm_access_scans`;
- cleanup includes `bgm_audit_log`, `bgm_member_stats`, `bgm_member_notifications`, `bgm_membership_reminder_log`, `bgm_member_password_resets`, and `bgm_member_push_subscriptions`;
- no delete/update of `legacy_pk_customer`, `bgm_member_card_credentials.barcode_value`, official photo ownership, membership ownership, status or expiry;
- explicit in-migration invariant checks raise exceptions on count mismatch, duplicate new numbers, invalid new format, non-contiguous rank or allocator mismatch.

- [ ] **Step 3: Run migration contract tests and verify RED**

Run:

```bash
node --test tests/phase-b-member-number-migration.test.mjs
```

Expected: FAIL because the migration body is not implemented yet.

- [ ] **Step 4: Implement the migration**

The migration must perform these operations in one PostgreSQL migration transaction:

1. Lock the member-number allocator row and lock `bgm_members` against concurrent writes affecting identity allocation during renumbering.
2. Validate all existing `member_number` values are old canonical seven-digit BGM values before building the one-time mapping.
3. Build a transaction-local temporary mapping with columns `member_id uuid`, `old_member_number text`, `new_member_number text`, `rank bigint`; order by old numeric value ascending then `id` ascending.
4. Validate mapping row count equals member row count; new numbers are unique, canonical and continuous from 1000.
5. Drop the existing `bgm_enforce_permanent_member_number_trigger` inside the transaction.
6. Drop/replace the old fixed-seven-digit check constraint so the bulk update is permitted.
7. Update `bgm_members.member_number` from the temporary mapping by UUID only; do not change UUID or any other member identity fields.
8. Rewrite `bgm_member_import_rows.resolved_membership_number` to each linked member's new BGM number using `matched_member_id` for rows containing the old BGM format.
9. Rewrite `bgm_member_import_review_items.member_number` to each linked member's new BGM number using `member_id` for rows containing the old BGM format.
10. Clear disposable test activity in foreign-key-safe order: `bgm_card_conflict_flags`, then `bgm_access_scans`, then the other approved test-history tables.
11. Replace the `bgm_member_number_state` check so `last_issued` is non-negative without the old 9,999,999 ceiling; set `last_issued` to the highest newly assigned numeric value.
12. Replace `bgm_next_member_number()` so it increments the bigint state atomically and returns `'BGM' || last_issued::text` without padding; keep privilege restrictions at least as strict as the current function.
13. Recreate `bgm_members_permanent_member_number_format_check` for the new canonical format.
14. Replace `bgm_enforce_permanent_member_number()` so existing canonical new-format numbers remain immutable and invalid/missing inserts allocate from `bgm_next_member_number()`.
15. Recreate the trigger and revoke/grant function execution consistently with the current service-role-only design.
16. Before transaction completion, assert member count unchanged, every member canonical/unique, min numeric BGM = 1000, max numeric BGM = `999 + member_count`, allocator equals max, and no old seven-digit member-number values remain in `bgm_members` or the two rewritten snapshot fields.

Do not persist the old→new mapping after commit.

- [ ] **Step 5: Run migration contract tests and verify GREEN**

Run:

```bash
node --test tests/phase-b-member-number-migration.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full relevant Node test set and build**

Run:

```bash
node --test tests/member-number-core.test.mjs tests/phase-b-member-number-runtime-contract.test.mjs tests/phase-b-member-number-migration.test.mjs tests/permanent-member-number-card-barcode-contract.test.mjs tests/member-number-schema.test.mjs
npm run build
```

`tests/member-number-schema.test.mjs` may need a narrowly scoped update so it recognizes the original migration as historical while asserting the new migration supersedes the allocator's active padding behavior. Do not rewrite historical SQL solely to satisfy this test.

- [ ] **Step 7: Commit**

```bash
git add "$PHASE_B_MIGRATION" tests/phase-b-member-number-migration.test.mjs tests/member-number-schema.test.mjs
git commit -m "feat: add atomic Phase B member renumbering migration"
```

---

### Task 4: TEST Preflight and Drift Gate

**Files:**
- No product files.
- Record results in PR description/comment or implementation notes; do not create a persistent old→new mapping artifact.

**Interfaces:**
- Consumes: TEST project `vlvyqdjhzdcxatilbdiv` and migration from Task 3.
- Produces: explicit approval-to-apply gate based on current TEST state.

- [ ] **Step 1: Re-run the read-only TEST preflight immediately before migration**

Verify:
- member count;
- all current member numbers match the old seven-digit format;
- duplicate count is zero;
- current allocator state;
- rank of `BGM0000007`;
- count/ownership of physical-card credentials;
- counts of old BGM snapshots in import rows/review items;
- counts of disposable test-history rows.

Expected from discovery at plan time:
- members: `25,511`;
- duplicate BGM numbers: `0`;
- `BGM0000007` rank: `4`, therefore expected new number `BGM1003`;
- expected last assigned after migration: `BGM26510`;
- expected next allocator output: `BGM26511`;
- old resolved-import snapshots: `76,501`, all with linked member UUID;
- old import-review snapshots: `5,005`, all with linked member UUID;
- test access scans: `73`;
- test audit rows: `193`;
- test card-conflict flags: `1`.

If member population/rank has drifted so `BGM0000007` would not become `BGM1003`, stop and report before applying. Small changes only in disposable test-history row counts do not block the migration.

- [ ] **Step 2: Capture relationship fingerprints before migration**

Using read-only SQL, capture aggregate invariants rather than exporting personal data:
- count and hash/aggregate of `(member_id, legacy_pk_customer)`;
- count and hash/aggregate of `(member_id, barcode_value, status)` from `bgm_member_card_credentials`;
- count and aggregate of official-photo ownership `(member_id, photo/path key)`;
- count and aggregate of membership ownership/link rows `(membership_id, member_id)`;
- status/expiry aggregate by member UUID.

These are compared after migration to prove relationship preservation without retaining old BGM aliases.

- [ ] **Step 3: Confirm the migration is still TEST-only**

Verify the connector/project ID is exactly `vlvyqdjhzdcxatilbdiv`. Do not execute any mutation against `jsuolemirhivqhjbjetv`.

---

### Task 5: Apply Phase B to TEST and Verify Database Invariants

**Files:**
- No new product files unless a defect is found; defects return to the owning earlier task with RED test first.

**Interfaces:**
- Consumes: `$PHASE_B_MIGRATION` and preflight fingerprints.
- Produces: TEST database in new numbering system.

- [ ] **Step 1: Apply the migration once to TEST**

Use the Supabase database migration mechanism against project `vlvyqdjhzdcxatilbdiv` only. Do not retry blindly if it fails; inspect the exact error and fix the migration on the feature branch first.

- [ ] **Step 2: Verify database numbering invariants**

Read-only checks must prove:
- member count unchanged from preflight;
- UUID set unchanged;
- minimum new number `BGM1000`;
- maximum new number equals `BGM(999 + preflight_member_count)`;
- every `member_number` matches canonical new format;
- no duplicate member numbers;
- numeric sequence has no gaps;
- no old seven-digit BGM values remain in `bgm_members.member_number`;
- allocator `last_issued` equals highest assigned numeric value;
- a transaction-wrapped allocator probe would return the next sequential number without consuming it permanently.

For the approved snapshot, verify specifically:
- former `BGM0000007` UUID now has `BGM1003`;
- old `BGM0000007` matches no `bgm_members.member_number` row;
- allocator next value is `BGM26511` before any later enrollment test creates another member.

- [ ] **Step 3: Verify relationship fingerprints are identical**

Compare pre/post aggregates for:
- UUID↔pkCustomer;
- UUID↔Scan3/physical-card credentials;
- UUID↔official photo;
- membership ownership/link rows;
- status and expiry by UUID.

Expected: identical.

- [ ] **Step 4: Verify source-history rewrite and test reset**

Assert:
- all prior `76,501` old `resolved_membership_number` snapshots are now the linked member's current new BGM value;
- all prior `5,005` review-item old `member_number` snapshots are now the linked member's current new BGM value;
- no old seven-digit BGM snapshot remains in those fields;
- pkCustomer, Scan3, source fingerprints, filenames, row numbers and matched member IDs remain populated as before;
- `bgm_card_conflict_flags`, `bgm_access_scans`, `bgm_audit_log`, `bgm_member_stats`, `bgm_member_notifications`, `bgm_membership_reminder_log`, `bgm_member_password_resets`, and `bgm_member_push_subscriptions` are reset to the agreed clean baseline.

- [ ] **Step 5: Verify database functions/constraint/trigger**

Inspect live TEST definitions and assert:
- member-number format constraint uses new canonical format;
- `bgm_next_member_number()` contains no zero-padding and has no 9,999,999 ceiling;
- `bgm_enforce_permanent_member_number()` recognizes new canonical numbers as immutable;
- trigger exists and is enabled;
- allocator/trigger function privileges remain restricted from browser roles.

If any database invariant fails, stop; do not proceed to app QA or Production discussion.

---

### Task 6: TEST Functional QA and CI

**Files:**
- Modify/add tests only if a defect is found, then return to RED→GREEN in the owning task.

**Interfaces:**
- Consumes: migrated TEST database and feature-branch application code.
- Produces: verified Phase B candidate branch ready for code review, not Production.

- [ ] **Step 1: Run all automated tests and build**

Run the repository's full CI-equivalent Node test suite used by the existing Phase 2 workflow, followed by type/build checks. At minimum rerun:

```bash
node --test tests/member-number-core.test.mjs tests/phase-b-member-number-runtime-contract.test.mjs tests/phase-b-member-number-migration.test.mjs tests/permanent-member-number-card-barcode-contract.test.mjs tests/member-number-schema.test.mjs
npm run build
```

Expected: PASS/build success.

- [ ] **Step 2: Deploy/use a TEST-backed Preview only**

Preview must point only to TEST Supabase. Because generic Preview environment safety is a known separate issue, use an existing TEST-locked Preview mechanism or otherwise prove the Preview Supabase URL is `https://vlvyqdjhzdcxatilbdiv.supabase.co` before any interactive mutation.

- [ ] **Step 3: Verify member login continuity**

Programmatically verify the member UUID behind `BGM1003` is still app-enrolled and has the same username/password hash fields as preflight. Then have the user confirm on their device that `BGM1003` + the existing password logs into the same account.

Verify `BGM0000007` is not a valid member-number login after migration.

- [ ] **Step 4: Verify Staff/Super Admin search and delete-confirmation format**

Check:
- exact search for `BGM1003` returns the correct member;
- variable-width search works for a five-digit BGM number;
- Super Admin member views/export show new BGM numbers;
- permanent-deletion confirmation accepts the new format and still requires exact current BGM number; do not actually delete the continuity member.

- [ ] **Step 5: Verify physical card/Scan3 behavior**

Use the existing TEST card assignment(s):
- physical card scan resolves the same member UUID as before;
- pkCustomer lookup resolves the same UUID(s) as before;
- duplicate/shared Scan3 flow still returns all matching candidates and supports Flag to Admin.

Do not alter physical barcode values to match the new BGM number.

- [ ] **Step 6: Verify member card/app barcode**

Confirm the member card displays the new public BGM number while the app barcode continues to use the active physical-card barcode when one exists. A member without an active physical card remains "Card not assigned"; Phase B must not synthesize a card barcode from the BGM number.

- [ ] **Step 7: Verify export/import compatibility**

- Export a member list and confirm canonical new BGM numbers appear.
- Run import preview/validation against representative rows so canonical `BGM1000+` values are accepted and leading-zero/under-1000 values are rejected.
- Confirm pkCustomer and Scan3 import rules are unchanged.

- [ ] **Step 8: Verify next-member allocation without contaminating baseline if possible**

Prefer a transaction-wrapped allocator or enrollment activation probe that rolls back after proving the next value is sequential. If the existing UI/E2E flow cannot be rolled back cleanly, create one clearly labeled TEST enrollment, verify it receives the expected next BGM number, and record the resulting new TEST member count/allocator state.

- [ ] **Step 9: Run GitHub CI for the exact feature-branch head**

Pin verification to the exact branch SHA. All required checks must be green before code review.

- [ ] **Step 10: Commit any QA-discovered fixes only after tests**

Each defect gets a failing test first, minimal fix, focused verification, then commit.

---

### Task 7: Review and Production Gate

**Files:**
- No product changes unless review finds an issue.

**Interfaces:**
- Consumes: fully verified TEST branch.
- Produces: reviewed Phase B candidate and explicit stop before Production.

- [ ] **Step 1: Run verification-before-completion**

Confirm exact branch SHA, clean diff scope, automated tests, build, TEST database invariants, TEST functional QA, and no Production mutation.

- [ ] **Step 2: Request code review**

Review specifically for:
- any path that can still issue/accept padded BGM numbers as current identities;
- migration reordering/locking/atomicity problems;
- accidental mutation of pkCustomer/Scan3/card/photo/membership relationships;
- unsafe test-history cleanup ordering;
- any persistent old→new alias/mapping artifact;
- JS number precision regressions;
- Production references or unintended environment changes.

- [ ] **Step 3: Open/update a draft PR against `main`**

PR must state clearly:
- TEST migration completed and verified;
- `BGM0000007 → BGM1003` continuity result;
- exact pre/post counts and relationship invariant results;
- old BGM aliases were not retained;
- test activity reset scope;
- Production remains untouched.

- [ ] **Step 4: STOP at Production gate**

Do not merge/deploy/apply migration to Production from this plan without a new explicit Production approval such as "Go live". Before any eventual Production execution, repeat a fresh read-only Production preflight and calculate live expected first/last/next numbers from the Production population at that moment.
