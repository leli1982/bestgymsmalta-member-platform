# Membership Settings & Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the centrally managed pricing, discount-code and immutable Gym Rules/declaration foundations required by tablet/staff enrollment without changing current Production behavior.

**Architecture:** Add small versioned Supabase tables and server-side read/publish helpers, then expose a Super Admin-only system API/UI. Public enrollment will later consume only published snapshots; staff cannot mutate prices or declaration wording. This plan also performs the Vercel branch guard before the implementation branch exists.

**Tech Stack:** Next.js 16, TypeScript, React, Supabase/PostgreSQL, Node test runner, existing BGM system-session auth.

**Spec:** `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md`

## Global Constraints

- Work from the current `feature/staff-dashboard-reception` dependency; do not merge PR #9 or Production as part of this plan.
- Before creating `feature/tablet-enrollment-membership-settings`, disable Vercel auto-deploy for that exact branch name.
- Super Admin is the only role allowed to create/publish prices, discount codes or declaration versions.
- Membership types remain `single`, `student`, `couples`; duration keys remain `1_week`, `2_weeks`, `1_month`, `3_months`, `6_months`, `1_year`.
- Currency is EUR and persisted as integer cents.
- Published versions are immutable. Editing creates a new draft/version and publication never rewrites a historical row.
- Discount percentage is integer `1..100`; use counting occurs only during successful activation in Plan 03.
- Exact Gym Rules/existing declaration source is `Generic Membership form.pdf`; do not paraphrase or invent privacy/health legal wording.
- Public enrollment remains disabled until required declaration categories have a published version.
- All date-window checks use `Europe/Malta` calendar-date semantics.

---

### Task 1: Protect the implementation branch before creating it

**Files:**
- Modify: `vercel.json`
- Test: `tests/vercel-deployment-guard.test.mjs`

**Interfaces:**
- Produces: Vercel `git.deploymentEnabled` entries for both staff and enrollment branches.

- [ ] **Step 1: Write the failing deployment-guard contract**

Create `tests/vercel-deployment-guard.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));

test("feature branches are Vercel-suppressed", () => {
  assert.equal(config.git.deploymentEnabled["feature/staff-dashboard-reception"], false);
  assert.equal(config.git.deploymentEnabled["feature/tablet-enrollment-membership-settings"], false);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --test tests/vercel-deployment-guard.test.mjs
```

Expected: FAIL because the enrollment branch key does not exist.

- [ ] **Step 3: Add the second branch guard**

Set `vercel.json` to:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "feature/staff-dashboard-reception": false,
      "feature/tablet-enrollment-membership-settings": false
    }
  }
}
```

- [ ] **Step 4: Re-run the contract and commit on the existing protected branch**

```bash
node --test tests/vercel-deployment-guard.test.mjs
git add vercel.json tests/vercel-deployment-guard.test.mjs
git commit -m "chore: suppress enrollment branch Vercel deploys"
```

- [ ] **Step 5: Verify Vercel created no deployment, then create isolated implementation branch/worktree**

Use Vercel deployment listing and confirm the newest deployment is unchanged. Then use the `superpowers:using-git-worktrees` skill and create `feature/tablet-enrollment-membership-settings` from this exact guard commit. Do not create the branch before Step 4 is committed.

---

### Task 2: Add immutable membership pricing, declaration and discount schema

**Files:**
- Create: `supabase/migrations/20260916_120000_membership_settings.sql`
- Create: `tests/membership-settings-schema.test.mjs`

**Interfaces:**
- Produces tables:
  - `bgm_membership_price_catalog_versions`
  - `bgm_membership_price_entries`
  - `bgm_membership_declaration_versions`
  - `bgm_discount_codes`
- Produces RPC: `bgm_publish_membership_price_catalog(uuid, uuid)`.
- Produces RPC: `bgm_publish_membership_declaration(uuid, uuid)`.

- [ ] **Step 1: Write schema contract tests**

Test the migration text for the exact table/constraint/RPC names and immutable-published trigger. Minimum assertions:

```js
assert.match(sql, /create table public\.bgm_membership_price_catalog_versions/i);
assert.match(sql, /create table public\.bgm_membership_price_entries/i);
assert.match(sql, /create table public\.bgm_membership_declaration_versions/i);
assert.match(sql, /create table public\.bgm_discount_codes/i);
assert.match(sql, /amount_cents integer/i);
assert.match(sql, /percentage integer/i);
assert.match(sql, /bgm_publish_membership_price_catalog/i);
assert.match(sql, /bgm_publish_membership_declaration/i);
```

- [ ] **Step 2: Run the schema test and verify RED**

```bash
node --test tests/membership-settings-schema.test.mjs
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Use these canonical columns:

```sql
create table public.bgm_membership_price_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version_no bigint generated always as identity unique,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id),
  created_at timestamptz not null default now()
);

create table public.bgm_membership_price_entries (
  catalog_version_id uuid not null references public.bgm_membership_price_catalog_versions(id) on delete cascade,
  membership_type text not null check (membership_type in ('single','student','couples')),
  duration_key text not null check (duration_key in ('1_week','2_weeks','1_month','3_months','6_months','1_year')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  primary key (catalog_version_id, membership_type, duration_key)
);

create table public.bgm_membership_declaration_versions (
  id uuid primary key default gen_random_uuid(),
  content_key text not null check (content_key in ('gym_rules','legacy_declaration','privacy','health','guardian')),
  version_no bigint not null,
  body text not null check (length(btrim(body)) > 0),
  content_sha256 text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by_system_user_id uuid references public.bgm_system_users(id),
  created_at timestamptz not null default now(),
  unique(content_key, version_no)
);

create table public.bgm_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percentage integer not null check (percentage between 1 and 100),
  active boolean not null default true,
  valid_from date,
  valid_until date,
  max_uses integer check (max_uses is null or max_uses > 0),
  successful_uses integer not null default 0 check (successful_uses >= 0),
  created_by_system_user_id uuid references public.bgm_system_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
```

Normalize codes server-side to `upper(trim(code))`. Add partial unique indexes enforcing one `published` price catalog and one published declaration per `content_key`. Publication RPCs must lock current published/draft rows, retire the old published row, publish the chosen draft, and write `bgm_system_audit_log` in the same transaction.

Add a trigger that rejects UPDATE/DELETE of already-published price entries/declaration bodies except the controlled `status -> retired` publication transition.

- [ ] **Step 4: Apply migration to the development Supabase project using the Supabase plugin**

Before any Supabase mutation, read `skills://plugins/supabase/supabase/skill.md`. Apply only to the development project used by the feature branch. Verify tables, indexes, RPCs and RLS/service-role posture with SQL introspection.

- [ ] **Step 5: Run schema test GREEN and commit**

```bash
node --test tests/membership-settings-schema.test.mjs
git add supabase/migrations/20260916_120000_membership_settings.sql tests/membership-settings-schema.test.mjs
git commit -m "feat: add versioned membership settings schema"
```

---

### Task 3: Add typed settings-domain helpers

**Files:**
- Create: `lib/membershipSettingsCore.ts`
- Create: `tests/membership-settings-core.test.mjs`

**Interfaces:**
- Produces:

```ts
export type MembershipType = "single" | "student" | "couples";
export type MembershipDurationKey = "1_week" | "2_weeks" | "1_month" | "3_months" | "6_months" | "1_year";
export type DeclarationKey = "gym_rules" | "legacy_declaration" | "privacy" | "health" | "guardian";
export function normalizeDiscountCode(value: string): string;
export function validatePriceMatrix(entries: PriceEntry[]): { ok: true } | { ok: false; error: string };
export function discountAmountCents(basePriceCents: number, percentage: number): number;
export function requiredDeclarationKeys(): DeclarationKey[];
```

- [ ] **Step 1: Write RED unit tests**

Cover all 18 type/duration price combinations, uppercase code normalization, round-to-nearest-cent percentage calculation using integer arithmetic, and required declaration keys exactly `gym_rules`, `privacy`, `health`.

Example:

```js
test("10 percent of 85 EUR is 8.50 EUR", () => {
  assert.equal(discountAmountCents(8500, 10), 850);
});
```

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/membership-settings-core.test.mjs
```

- [ ] **Step 3: Implement the minimal pure functions**

Use integer cents only:

```ts
export function discountAmountCents(base: number, percentage: number) {
  if (!Number.isInteger(base) || base < 0) throw new Error("Invalid base price.");
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
    throw new Error("Invalid discount percentage.");
  }
  return Math.round((base * percentage) / 100);
}
```

`validatePriceMatrix` must require one and only one entry for every type × duration combination.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/membership-settings-core.test.mjs
git add lib/membershipSettingsCore.ts tests/membership-settings-core.test.mjs
git commit -m "feat: add membership settings domain rules"
```

---

### Task 4: Add Super Admin-only settings API

**Files:**
- Create: `app/api/system/membership-settings/route.ts`
- Modify: `lib/systemAuth.ts`
- Create: `tests/membership-settings-api-contract.test.mjs`

**Interfaces:**
- Produces `requireSuperAdmin(request)` returning the existing `SystemContext` or a 401/403 response.
- `GET /api/system/membership-settings` returns drafts/current published prices, declaration versions and discount codes.
- `POST /api/system/membership-settings` actions:
  - `save_price_draft`
  - `publish_price_catalog`
  - `save_declaration_draft`
  - `publish_declaration`
  - `save_discount_code`
  - `set_discount_active`

- [ ] **Step 1: Write RED API source-contract tests**

Require use of `requireSuperAdmin`, server-side `normalizeDiscountCode`, `validatePriceMatrix`, and calls to publication RPCs. Assert no API action accepts `successful_uses` from the client.

- [ ] **Step 2: Add `requireSuperAdmin`**

Implement in `lib/systemAuth.ts`:

```ts
export async function requireSuperAdmin(request: NextRequest) {
  const context = await getSystemContext(request);
  if (!context) return { context: null, error: NextResponse.json({ error: "System login required." }, { status: 401 }) };
  if (!context.isSuperAdmin) return { context: null, error: NextResponse.json({ error: "Super Admin access required." }, { status: 403 }) };
  return { context, error: null };
}
```

- [ ] **Step 3: Implement the route with strict action parsing**

Each write action obtains `auth.context.systemUserId`; never trusts a caller-supplied user id. Persist EUR cents. Publish through the RPCs from Task 2. On reads, return body text only to authenticated Super Admin; the public read interface is introduced in Plan 02.

- [ ] **Step 4: Run API contracts and commit**

```bash
node --experimental-strip-types --test tests/membership-settings-api-contract.test.mjs tests/membership-settings-core.test.mjs
git add app/api/system/membership-settings/route.ts lib/systemAuth.ts tests/membership-settings-api-contract.test.mjs
git commit -m "feat: add super admin membership settings api"
```

---

### Task 5: Build the minimal Membership Settings UI

**Files:**
- Create: `app/staff/membership-settings/page.tsx`
- Create: `components/staff/MembershipSettingsAdmin.tsx`
- Modify: `components/staff/StaffDashboard.tsx`
- Create: `tests/membership-settings-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `/api/system/membership-settings`.
- Produces: Super Admin-only UI sections `Pricing`, `Discount Codes`, `Rules & Declarations`.

- [ ] **Step 1: Write RED UI contract**

Assert the page/component exposes all 18 price cells, code percentage/date/max-use controls, version/publish controls for all declaration keys, and renders a clear access-denied state for non-Super Admin users.

- [ ] **Step 2: Implement the page shell and Super Admin gate**

Use `/api/system/auth` to resolve `isSuperAdmin`. Do not show the dashboard entry point to ordinary gym staff.

- [ ] **Step 3: Implement pricing and discount editors**

Use integer cents internally; display EUR using `Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" })`. Saving edits a draft; only explicit **Publish Prices** changes the public/current catalog.

- [ ] **Step 4: Implement declaration editor/version list**

Show content key, current published version, draft body, SHA/version after publication and publication timestamp. Publishing is explicit and historical versions remain read-only.

- [ ] **Step 5: Run UI contract and commit**

```bash
node --experimental-strip-types --test tests/membership-settings-ui-contract.test.mjs tests/membership-settings-api-contract.test.mjs
git add app/staff/membership-settings/page.tsx components/staff/MembershipSettingsAdmin.tsx components/staff/StaffDashboard.tsx tests/membership-settings-ui-contract.test.mjs
git commit -m "feat: add super admin membership settings ui"
```

---

### Task 6: Seed source-backed Gym Rules and enforce launch readiness

**Files:**
- Create: `supabase/migrations/20260916_121000_membership_declaration_seed.sql`
- Create: `lib/membershipEnrollmentReadiness.ts`
- Create: `tests/membership-declaration-seed.test.mjs`
- Create: `tests/membership-enrollment-readiness.test.mjs`

**Interfaces:**
- Produces `getEnrollmentReadiness(publishedDeclarations)` returning:

```ts
{ ready: boolean; missing: Array<"gym_rules" | "privacy" | "health"> }
```

- [ ] **Step 1: Materialize/read `Generic Membership form.pdf` and transcribe the source text verbatim**

The implementation session must use the user Library source, not memory. Copy the eleven Gym Rules and the existing legacy declaration exactly. Compute SHA-256 from the exact UTF-8 bodies and put those hashes in the seed migration. Do not seed invented privacy or health wording if the PDF does not contain it.

- [ ] **Step 2: Write RED seed/readiness tests**

The seed test must require exactly eleven numbered rules and verify the migration inserts `gym_rules` and `legacy_declaration` with `status='published'`. It must also assert the migration contains no fabricated `privacy` or `health` body unless exact user-approved source text has been supplied.

Readiness test:

```js
assert.deepEqual(getEnrollmentReadiness(new Set(["gym_rules"])), {
  ready: false,
  missing: ["privacy", "health"],
});
```

- [ ] **Step 3: Implement seed migration and readiness helper**

Only publish source-backed content. Privacy and health become launch-ready when Super Admin publishes real text through the UI.

- [ ] **Step 4: Apply seed migration to development Supabase and verify hashes/content**

Compare database body text and SHA-256 against the exact local transcription before proceeding.

- [ ] **Step 5: Run tests and commit**

```bash
node --experimental-strip-types --test tests/membership-declaration-seed.test.mjs tests/membership-enrollment-readiness.test.mjs
git add supabase/migrations/20260916_121000_membership_declaration_seed.sql lib/membershipEnrollmentReadiness.ts tests/membership-declaration-seed.test.mjs tests/membership-enrollment-readiness.test.mjs
git commit -m "feat: seed versioned BGM membership rules"
```

---

### Task 7: Plan-01 verification gate

**Files:**
- No new product files unless verification exposes a real defect.

- [ ] **Step 1: Run targeted suite**

```bash
node --experimental-strip-types --test \
  tests/vercel-deployment-guard.test.mjs \
  tests/membership-settings-schema.test.mjs \
  tests/membership-settings-core.test.mjs \
  tests/membership-settings-api-contract.test.mjs \
  tests/membership-settings-ui-contract.test.mjs \
  tests/membership-declaration-seed.test.mjs \
  tests/membership-enrollment-readiness.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run TypeScript/build**

```bash
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: both PASS.

- [ ] **Step 3: Confirm no Vercel deployment was created**

List BGM deployments and verify branch pushes remain suppressed.

- [ ] **Step 4: Commit only if verification required a real fix**

If no fix was required, do not create an empty commit. Plan 02 starts only after this gate is clean.