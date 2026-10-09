# C4 Google Wallet Membership Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Google Wallet membership pass that mirrors BestGymsMalta's existing member/card state, uses the current active physical-card barcode for scanning, and stays synchronized across renewal, replacement, cancellation, archive/restore, and membership-date changes without becoming a second source of identity or access truth.

**Architecture:** Keep BGM authoritative and make Google Wallet a server-managed projection. Add a server-only Wallet core/client, one persistent pass-mapping row per member who actually provisions a pass, database triggers that only mark existing pass rows pending, best-effort sync after centralized BGM mutations, and a bounded recovery engine attached to the existing secured daily cron. The member UI only requests a signed save URL; credentials, OAuth tokens, signing keys, and Google REST calls remain server-side.

**Tech Stack:** Next.js 16, TypeScript, Node.js 22, Supabase/PostgreSQL, Vercel, Google Wallet Generic Pass REST API, `google-auth-library`, Node `crypto`, Node test runner, Playwright/Chromium.

**Spec:** `docs/superpowers/specs/2026-10-09-google-wallet-membership-c4.md`

## Global Constraints

- BGM database/member-card state remains the sole source of truth for identity, membership eligibility, card validity, and gym access.
- Wallet barcode value must equal the member's current active physical-card credential, never the permanent BGM number.
- Wallet uses `GENERIC_GYM_MEMBERSHIP`; active scannable barcode uses `CODE_128`.
- One stable Google `GenericObject` per BGM member UUID; renewal/card replacement updates the same object.
- BGM expiry date remains valid for the entire Malta calendar day; Wallet expiry is the following Malta midnight.
- A future cancellation ends Wallet validity at the start of its cancellation-effective Malta date; use the earlier of cancellation midnight and post-expiry midnight.
- C1 seven-day app renewal grace never extends Wallet access validity.
- Expired, cancelled, archived, inactive, or cardless states must not leave an old scannable barcode displayed as current.
- Google-generated expiry/upcoming notifications stay disabled; C3 remains the notification system.
- Member photo is not exported to Google Wallet in C4.
- TEST and Production must use different class suffixes/object prefixes.
- Google service-account email/private key, OAuth tokens, and signing material never reach client JavaScript or API responses.
- BGM writes succeed independently of Google; a Wallet API outage may mark sync failed/pending but must not roll back a successful membership/card operation.
- Production schema changes, Production credentials, and real-member pass issuance require a separate explicit owner approval after TEST verification, full CI, and Preview success.

## Configuration Contract

Server-only environment variables:

- `GOOGLE_WALLET_ENABLED` — exact `true` enables the feature for the environment.
- `GOOGLE_WALLET_ISSUER_ID` — Google Wallet issuer ID.
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` — authorized service account email.
- `GOOGLE_WALLET_PRIVATE_KEY` — PEM private key; normalize escaped `\\n` server-side.
- `GOOGLE_WALLET_CLASS_SUFFIX` — e.g. TEST `bgm_membership_test_v1`, Production `bgm_membership_v1`.
- `GOOGLE_WALLET_OBJECT_PREFIX` — e.g. TEST `test_`, Production `prod_`.
- `GOOGLE_WALLET_ORIGIN` — exact trusted application origin used in the save JWT.
- `GOOGLE_WALLET_LOGO_URL` — stable public HTTPS BGM logo asset.
- `GOOGLE_WALLET_APP_URL` — stable member-card/app link placed on the pass.

Do not expose any of these as `NEXT_PUBLIC_*` variables.

## Review Focus

- **DST validity boundary:** 23/25-hour Malta DST days still end the pass at the correct local midnight. Task 1 tests both DST boundary shapes using `maltaDayUtcRange`.
- **Scheduled future cancellation:** a pass already synchronized today automatically expires at cancellation-effective Malta midnight without requiring another database write that day. Task 1 pins this in pure-state tests.
- **Card replacement during Google outage:** old BGM barcode becomes invalid immediately while Wallet sync failure remains non-blocking and recoverable. Tasks 6 and 7 test this route behavior and pending recovery.
- **Repeated Add presses/concurrent provisioning:** repeated requests resolve to the same deterministic object/mapping and never create duplicate pass IDs. Tasks 2–4 test deterministic IDs, unique mapping, and idempotent object upsert.
- **Credential leakage:** malformed Google errors/private keys/tokens never appear in member responses, logs returned to clients, or client bundles. Tasks 3–5 test safe error mapping and server-only module boundaries.

---

### Task 1: Add pure Wallet state/validity rules

**Files:**
- Create: `lib/googleWalletCore.ts`
- Modify: `lib/maltaDate.ts`
- Create: `tests/google-wallet-core.test.mjs`

**Interfaces:**
- Consumes existing `todayMaltaDate()` and `maltaDayUtcRange(calendarDate)` from `lib/maltaDate.ts`.
- Produces:
  - `type GoogleWalletMemberSnapshot`
  - `type GoogleWalletEligibilityReason`
  - `type GoogleWalletProjection`
  - `googleWalletObjectSuffix(memberId: string, prefix: string): string`
  - `googleWalletClassId(issuerId: string, classSuffix: string): string`
  - `googleWalletObjectId(issuerId: string, memberId: string, prefix: string): string`
  - `googleWalletValidityEnd(expiryDate: string | null, cancellationEffectiveDate: string | null): string | null`
  - `projectGoogleWalletMember(snapshot: GoogleWalletMemberSnapshot, today: string): GoogleWalletProjection`
- Add one small exported Malta helper only if needed: `maltaMidnightUtc(calendarDate: string): string`, implemented by reusing `maltaDayUtcRange(calendarDate).start` rather than duplicating timezone arithmetic.

- [ ] **Step 1: Write RED tests for deterministic IDs, eligibility, active projection, inactive/cardless projection, expiry-day inclusion, future-cancellation precedence, already-effective cancellation, and Malta DST boundaries.**

Core assertions must include:

```js
assert.equal(active.barcode.type, "CODE_128");
assert.equal(active.barcode.value, "CARD-123");
assert.equal(active.state, "ACTIVE");
assert.equal(expired.eligibleToAdd, false);
assert.notEqual(inactive.barcode?.value, "CARD-123");
```

Use dates spanning Malta DST transitions and assert the absolute timestamps from `maltaDayUtcRange`/`maltaMidnightUtc` rather than assuming every day is 24 hours.

- [ ] **Step 2: Run the focused test and confirm RED.**

Run: `node --experimental-strip-types --test tests/google-wallet-core.test.mjs`

Expected: FAIL because `lib/googleWalletCore.ts`/new interfaces do not exist.

- [ ] **Step 3: Implement the pure projection rules and minimal Malta helper.**

Projection requirements:
- active + unexpired + not effectively cancelled + active card => `ACTIVE`, `CODE_128`, current physical credential;
- future cancellation retains active state but shortens `validTimeInterval.end` to cancellation Malta midnight when earlier;
- expired => `EXPIRED`/non-scannable projection;
- archived/inactive/effective cancellation/no active card => `INACTIVE`/non-scannable projection;
- display expiry remains DD/MM/YYYY-compatible input/output data, but Google timestamps stay ISO instants;
- permanent BGM number is display text only and never barcode/object identity.

- [ ] **Step 4: Run the focused test GREEN.**

- [ ] **Step 5: Commit.**

```bash
git add lib/googleWalletCore.ts lib/maltaDate.ts tests/google-wallet-core.test.mjs
git commit -m "feat: add Google Wallet membership projection rules"
```

### Task 2: Add the Wallet pass mapping schema and pending-sync triggers

**Files:**
- Create: `supabase/migrations/20261009040000_google_wallet_membership_passes.sql`
- Create: `tests/google-wallet-schema-contract.test.mjs`

**Interfaces:**
- Creates server-managed `public.bgm_google_wallet_passes` exactly as specified:
  - `member_id uuid primary key references bgm_members(id) on delete cascade`
  - `object_id text not null unique`
  - `class_id text not null`
  - `sync_status text not null default 'pending' check in ('pending','synced','failed')`
  - `last_attempt_at`, `last_synced_at`, `last_error`, `created_at`, `updated_at`
- RLS enabled; no anon/authenticated grants; service-role server access only.
- Adds trigger functions that only update existing Wallet rows to `pending` and clear stale error text.
- Member trigger watches displayed/eligibility fields: `member_number`, `full_name`, `first_name`, `last_name`, `status`, `membership_expiry`, `cancellation_effective_date`, `archived_at`.
- Card trigger watches INSERT/UPDATE/DELETE and marks both `OLD.member_id` and `NEW.member_id` pending when applicable.

- [ ] **Step 1: Write RED schema-contract tests.**

Require:
- exact table columns/check constraint/unique object ID;
- RLS enablement;
- revoke/no direct `anon`/`authenticated` grants;
- triggers never insert Wallet-pass rows and contain no network extension/HTTP behavior;
- card reassignment references both OLD and NEW member IDs;
- member updates mark only already-provisioned rows pending.

- [ ] **Step 2: Run focused test RED.**

Run: `node --experimental-strip-types --test tests/google-wallet-schema-contract.test.mjs`

- [ ] **Step 3: Implement the additive migration.**

No changes to existing member/card constraints or access RPC behavior.

- [ ] **Step 4: Run focused test GREEN.**

- [ ] **Step 5: Apply this migration to TEST Supabase only.**

Verify by read-only SQL:
- table/defaults/checks exist;
- RLS enabled;
- no `anon`/`authenticated` table grants;
- inserting a fake TEST mapping then updating the fake member/card marks it `pending`;
- no mapping row appears for members who never provisioned Wallet.

Do not apply Production here.

- [ ] **Step 6: Commit.**

```bash
git add supabase/migrations/20261009040000_google_wallet_membership_passes.sql tests/google-wallet-schema-contract.test.mjs
git commit -m "feat: add Google Wallet pass sync schema"
```

### Task 3: Add the server-only Google Wallet client and save-JWT signer

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/googleWalletServer.ts`
- Create: `tests/google-wallet-server-contract.test.mjs`

**Interfaces:**
- Add only `google-auth-library` as the Google SDK dependency; use native `fetch` for Wallet REST and Node `crypto` for save-JWT signing.
- Produces:
  - `type GoogleWalletConfig`
  - `getGoogleWalletConfig(): GoogleWalletConfig | null`
  - `ensureGoogleWalletClass(config: GoogleWalletConfig): Promise<string>`
  - `upsertGoogleWalletObject(snapshot: GoogleWalletMemberSnapshot, config: GoogleWalletConfig): Promise<{ objectId: string; classId: string }>`
  - `buildGoogleWalletSaveUrl(objectId: string, config: GoogleWalletConfig): string`
  - `safeGoogleWalletError(error: unknown): string`
- OAuth scope: `https://www.googleapis.com/auth/wallet_object.issuer`.
- REST base: `https://walletobjects.googleapis.com/walletobjects/v1`.
- Save URL prefix: `https://pay.google.com/gp/v/save/`.

- [ ] **Step 1: Install `google-auth-library` and let npm update the lockfile.**

Run: `npm install google-auth-library`

- [ ] **Step 2: Write RED tests for configuration validation, escaped-newline private-key normalization, deterministic class/object IDs, signed JWT claims, class create-on-404, object create-on-404, PATCH on existing object, and safe error redaction.**

Use a generated ephemeral RSA keypair in tests. Decode the JWT payload and require:
- `iss` = configured service-account email;
- `aud` = `google`;
- `typ` = `savetowallet`;
- `origins` contains only configured origin;
- payload references the deterministic existing object ID;
- private key/access token never appears in returned values/errors.

Mock native `fetch`; no real Google request in unit tests.

- [ ] **Step 3: Run focused test RED.**

Run: `node --experimental-strip-types --test tests/google-wallet-server-contract.test.mjs`

- [ ] **Step 4: Implement `lib/googleWalletServer.ts` as `server-only`.**

Rules:
- `GOOGLE_WALLET_ENABLED !== "true"` => feature unavailable, not an exception;
- all other required variables must validate when enabled;
- class is one shared environment class and does not configure Google expiry/upcoming notifications;
- object body is built from `projectGoogleWalletMember`;
- normal existing-object changes use PATCH and explicitly overwrite state/barcode/validity/display fields owned by BGM;
- 404 means create; auth/config/other Google failures surface only through safe error summaries;
- no full `googleapis` dependency.

- [ ] **Step 5: Run focused test GREEN, then `npx tsc --noEmit`.**

- [ ] **Step 6: Commit.**

```bash
git add package.json package-lock.json lib/googleWalletServer.ts tests/google-wallet-server-contract.test.mjs
git commit -m "feat: add server Google Wallet client"
```

### Task 4: Add canonical member snapshot loading, durable sync, and member API

**Files:**
- Create: `lib/googleWalletSync.ts`
- Create: `app/api/member/google-wallet/route.ts`
- Create: `tests/google-wallet-member-api.test.mjs`

**Interfaces:**
- `loadGoogleWalletMemberSnapshot(memberId: string): Promise<GoogleWalletMemberSnapshot>` loads BGM member plus latest current `bgm_member_card_credentials.status='active'` credential server-side.
- `syncGoogleWalletPassForMember(memberId: string, options?: { provision?: boolean }): Promise<{ status: 'synced'|'not_provisioned'|'unavailable'|'failed'; objectId?: string }>`
  - `provision:false` never creates a mapping for members who never asked for Wallet;
  - `provision:true` creates/upserts the deterministic mapping and object.
- `bestEffortSyncGoogleWalletMembers(memberIds: string[]): Promise<void>` dedupes IDs, never throws into the caller, and updates mapping status safely.
- `GET /api/member/google-wallet` returns only member-safe capability/status:
  - `{ available, eligible, reason, provisioned, syncStatus, lastSyncedAt }`.
- `POST /api/member/google-wallet` requires member session, enforces canonical eligibility, provisions/syncs same object, and returns `{ saveUrl }`.

- [ ] **Step 1: Write RED route/sync tests.**

Require:
- 401 without member session;
- unavailable config returns member-safe unavailable status and creates nothing;
- archived/expired/effective-cancellation/cardless members cannot provision;
- active expiry-day member can provision;
- repeated POSTs reuse one deterministic mapping/object ID;
- DB row records `pending -> synced`, timestamps, and safe `failed` state;
- raw Google/private-key/token error content never reaches route response;
- `provision:false` does not create rows.

- [ ] **Step 2: Run focused test RED.**

Run: `node --experimental-strip-types --test tests/google-wallet-member-api.test.mjs`

- [ ] **Step 3: Implement snapshot loader, durable sync helper, GET, and POST.**

Use existing `getMemberRequestSession`, `getSupabaseAdmin`, `todayMaltaDate`, and active-card credential model. Do not authorize from localStorage/client state.

- [ ] **Step 4: Run focused tests GREEN and typecheck.**

- [ ] **Step 5: Commit.**

```bash
git add lib/googleWalletSync.ts app/api/member/google-wallet/route.ts tests/google-wallet-member-api.test.mjs
git commit -m "feat: add member Google Wallet API"
```

### Task 5: Add the official Add to Google Wallet member UI

**Files:**
- Add unchanged official Google-provided button asset under: `public/google-wallet/add-to-google-wallet.svg` (or the official current equivalent filename/format)
- Create: `components/member/GoogleWalletButton.tsx`
- Modify: `components/member/MemberCard.tsx`
- Create: `tests/google-wallet-ui-contract.test.mjs`
- Modify: `tests/browser/member-card-gyms.mjs`

**Interfaces:**
- `GoogleWalletButton` calls GET status after the full member card reaches a ready/authenticated state.
- Eligible click POSTs `/api/member/google-wallet`, disables duplicate clicks while pending, then navigates to the returned `saveUrl`.
- Unconfigured Wallet action is hidden rather than rendered broken.
- Canonically ineligible member sees concise non-technical reason; no save URL is requested.
- Home compact card remains visually unchanged; Wallet control appears only on the full card view.

- [ ] **Step 1: Download the official current Google Add to Wallet button asset from Google's branding resources and commit it unchanged. Do not redraw/retype the brand button.**

- [ ] **Step 2: Write RED UI contract tests for official asset use, endpoint paths, loading guard, full-card-only placement, and no secret/env references in client files.**

- [ ] **Step 3: Extend `tests/browser/member-card-gyms.mjs` with mocked Wallet APIs.**

Browser assertions:
- eligible member sees official Add button;
- click makes exactly one POST and navigates toward returned save URL (intercept navigation safely; never contact Google);
- unavailable config hides the action;
- cardless/expired fixture does not offer an active save action;
- existing barcode remains current physical card and BGM number stays separate;
- no mobile horizontal overflow at 320/390px.

- [ ] **Step 4: Run focused contract test RED.**

- [ ] **Step 5: Implement the component/card integration.**

- [ ] **Step 6: Run focused contract test GREEN. Build before browser test.**

Run:
```bash
node --experimental-strip-types --test tests/google-wallet-ui-contract.test.mjs
npm run build
node tests/browser/member-card-gyms.mjs
```

- [ ] **Step 7: Commit.**

```bash
git add public/google-wallet components/member/GoogleWalletButton.tsx components/member/MemberCard.tsx tests/google-wallet-ui-contract.test.mjs tests/browser/member-card-gyms.mjs
git commit -m "feat: add Google Wallet member action"
```

### Task 6: Add immediate non-blocking synchronization to centralized BGM mutations

**Files:**
- Modify: `app/api/system/members/card/replace/route.ts`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/membership-dates/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/cancellation/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/couples-cancellation/route.ts`
- Modify: `app/api/system/admin/members/[memberId]/account-status/route.ts`
- Create: `tests/google-wallet-sync-hooks.test.mjs`

**Interfaces:**
- Every route calls `bestEffortSyncGoogleWalletMembers([...affectedMemberIds])` only **after** its existing BGM mutation/RPC succeeds.
- The helper never changes the route's successful business result into a failure merely because Google is unavailable.
- Routes do not provision a Wallet row for members who never requested a pass (`provision:false` semantics).

- [ ] **Step 1: Write RED route-contract tests requiring post-success hooks and prohibiting pre-RPC sync.**

Coverage:
- card replacement => affected member;
- activation/renewal => all activated participant member IDs (derive them from activation result or re-query the application/member links after success; do not guess a single member);
- personal-profile display-name changes => member;
- membership-date correction => member;
- individual cancellation schedule/withdraw => member;
- couples cancellation schedule/withdraw => both member + partner;
- archive/restore => member.

- [ ] **Step 2: Add behavior tests with a rejected sync promise proving each canonical BGM mutation still returns its existing success response.**

Card replacement is the critical assertion: replacement succeeds, old credential is retired by existing RPC, sync failure is recorded but cannot restore old-card access.

- [ ] **Step 3: Run focused test RED.**

Run: `node --experimental-strip-types --test tests/google-wallet-sync-hooks.test.mjs`

- [ ] **Step 4: Implement the minimal post-success calls without restructuring the existing BGM transactions/RPCs.**

- [ ] **Step 5: Run focused Wallet hook tests plus existing relevant regressions GREEN.**

Run:
```bash
node --experimental-strip-types --test tests/google-wallet-sync-hooks.test.mjs tests/member-card-replacement-contract.test.mjs tests/member-cancellation.test.mjs tests/member-couples-cancellation.test.mjs tests/member-account-actions.test.mjs tests/member-date-correction.test.mjs tests/super-admin-member-editor.test.mjs
```

- [ ] **Step 6: Commit.**

```bash
git add app/api/system tests/google-wallet-sync-hooks.test.mjs
git commit -m "feat: sync Wallet after member state changes"
```

### Task 7: Add bounded recovery synchronization to the existing secured daily cron

**Files:**
- Create: `lib/googleWalletSyncEngine.ts`
- Modify: `app/api/cron/membership-expiry-reminders/route.ts`
- Create: `tests/google-wallet-sync-engine.test.mjs`
- Modify: `tests/member-engagement-engine-contract.test.mjs`
- Modify: `tests/membership-reminders-contract.test.mjs`

**Interfaces:**
- `runGoogleWalletRecoverySync(options?: { pageSize?: number }): Promise<{ examined: number; synced: number; failed: number; skipped: number }>`
- Processes only provisioned mapping rows whose `sync_status in ('pending','failed')`, in bounded pages/order.
- Calls `syncGoogleWalletPassForMember(memberId, { provision: false })` per row with per-member failure isolation.
- Existing cron returns three independently caught outcomes:
  - `membershipReminders`
  - `memberEngagement`
  - `googleWalletSync`

- [ ] **Step 1: Write RED tests for bounded paging, only pending/failed rows, no provisioning, one-member failure isolation, and independent cron outcomes.**

- [ ] **Step 2: Run focused test RED.**

- [ ] **Step 3: Implement recovery engine and add it as the third `runEngine(...)` call in the existing cron.**

Do not add a second Vercel cron entry. Preserve `CRON_SECRET`, Node runtime, and the existing reminder/engagement behavior.

- [ ] **Step 4: Run focused tests GREEN.**

Run:
```bash
node --experimental-strip-types --test tests/google-wallet-sync-engine.test.mjs tests/member-engagement-engine-contract.test.mjs tests/membership-reminders-contract.test.mjs
```

- [ ] **Step 5: Commit.**

```bash
git add lib/googleWalletSyncEngine.ts app/api/cron/membership-expiry-reminders/route.ts tests/google-wallet-sync-engine.test.mjs tests/member-engagement-engine-contract.test.mjs tests/membership-reminders-contract.test.mjs
git commit -m "feat: recover pending Google Wallet syncs"
```

### Task 8: Add CI coverage and TEST Google Wallet integration

**Files:**
- Modify: `.github/workflows/phase2-ci.yml`
- Create: `tests/browser/google-wallet-member.mjs` only if separation from `member-card-gyms.mjs` improves reliability; otherwise keep browser coverage in the existing member-card script.
- Create: `docs/google-wallet-test-rollout.md`

**Interfaces:**
- CI never needs real Google credentials; unit/contract/browser tests mock Google REST and sign with an ephemeral test RSA key.
- TEST Vercel/Supabase integration uses dedicated TEST issuer class suffix/object prefix and a fictional TEST member only.

- [ ] **Step 1: Add a dedicated CI browser step only if a separate script was created; otherwise document that the existing member-card browser step covers Wallet.**

- [ ] **Step 2: Write TEST rollout checklist documenting required Google Wallet issuer/service-account setup and exact TEST env-variable names without secret values.**

Checklist must require:
- Google Wallet API enabled;
- issuer account approved/usable;
- service account granted issuer access;
- TEST-only class suffix/object prefix;
- TEST Vercel secrets entered directly in Vercel, never chat/commit;
- fictional TEST member with active card;
- no Production issuer/object naming during TEST.

- [ ] **Step 3: Run the full local/CI-equivalent verification.**

Run:
```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
node tests/browser/membership-print-a4.mjs
node tests/browser/member-card-gyms.mjs
node tests/browser/member-engagement-notifications.mjs
node tests/browser/super-admin-member-editor.mjs
node tests/browser/super-admin-couples-member-editor.mjs
node tests/browser/staff-dashboard.mjs
node tests/browser/staff-global-scanner.mjs
node tests/browser/bar-sales.mjs
node tests/browser/operations-dashboard.mjs
node tests/browser/super-admin-announcements.mjs
node tests/browser/member-data.mjs
node tests/browser/super-admin-management.mjs
node tests/browser/shopping-list.mjs
node tests/browser/reception-photo-warning.mjs
node tests/browser/staff-enrollment-gym.mjs
node tests/browser/staff-minor-renewal.mjs
node tests/browser/tablet-enrollment.mjs
```

- [ ] **Step 4: Configure TEST Google credentials only after code/tests are green.**

The user enters secrets directly in Vercel. Verify variable presence/target environment without revealing secret values.

- [ ] **Step 5: Perform a TEST sandbox/manual integration with one fictional TEST member.**

Verify:
- Add action produces Google save page;
- pass displays expected member name/BGM number/expiry/current card barcode;
- second Add action references same object;
- TEST card replacement changes BGM access immediately and patches same Wallet object;
- TEST renewal extends the same Wallet object's validity;
- scheduled cancellation produces the correct future Malta validity end;
- archive/effective cancellation/cardless state removes scannable active credential;
- recovery of a deliberately failed/pending TEST row updates status later without creating duplicates.

Do not use a real Production member.

- [ ] **Step 6: Run TEST Supabase advisors/security review and verify the new table is server-managed/RLS-protected.**

- [ ] **Step 7: Commit CI/docs changes.**

```bash
git add .github/workflows/phase2-ci.yml docs/google-wallet-test-rollout.md tests/browser
git commit -m "test: verify Google Wallet membership flow"
```

### Task 9: Final branch verification, PR, and Production approval gate

**Files:**
- No new product file is mandatory; update docs only if final verification discovers a documented operational requirement.

**Interfaces:**
- Feature branch must remain merge-gated by owner approval.
- Production migration/credentials/pass issuance remain separately approval-gated even if PR CI is green.

- [ ] **Step 1: Re-run the full node test suite, TypeScript, production build, and all browser regression checks on the final branch head.**

- [ ] **Step 2: Verify the Vercel Preview deployment is READY and inspect runtime/build logs for Wallet-related errors without invoking any Production cron or issuing real-member passes.**

- [ ] **Step 3: Re-read the C4 spec line by line against final code/tests.**

Explicitly verify:
- same physical barcode is used;
- BGM number stays display-only;
- one stable object per member;
- expiry/cancellation Malta semantics;
- non-scannable inactive states;
- no photo exported;
- no Google expiry notifications;
- no secret/client leakage;
- BGM-first mutation semantics;
- recovery engine is bounded and independent;
- TEST/Production namespace separation.

- [ ] **Step 4: Open C4 PR to `main` as Draft and include exact TEST evidence, migration contents, required Production env names, and explicit statement that Production has not been changed.**

- [ ] **Step 5: Present the exact Production rollout for owner approval.**

The approval request must separately enumerate:
1. additive Production Supabase migration;
2. Production Google Wallet issuer/service-account configuration and Vercel secret names;
3. Production class/object namespace values;
4. merge/deploy of the C4 PR;
5. confirmation that the next normal daily cron may synchronize only already-provisioned Wallet rows;
6. no manual Production cron trigger unless separately approved because it may affect live external passes.

- [ ] **Step 6: Stop. Do not apply Production migration, add Production Google secrets, merge the PR, or issue a real-member pass without explicit owner approval.**
