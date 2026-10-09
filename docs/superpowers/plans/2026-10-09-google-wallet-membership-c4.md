# C4 Google Wallet Membership Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Google Wallet membership pass that mirrors BestGymsMalta's existing member/card state, uses the current active physical-card barcode for scanning, and stays synchronized across renewal, replacement, cancellation, archive/restore, and membership-date changes without becoming a second source of identity or access truth.

**Architecture:** BGM remains authoritative. Google Wallet is a server-managed projection: one deterministic `GenericObject` per BGM member UUID, one mapping row only after the member provisions Wallet, database triggers that only mark existing mappings pending, immediate best-effort sync after canonical BGM mutations, and a bounded recovery engine inside the existing secured daily cron. The browser receives only member-safe status plus a signed save URL; Google credentials, OAuth tokens, signing keys, and REST calls remain server-side.

**Tech Stack:** Next.js 16, TypeScript, Node.js 22, Supabase/PostgreSQL, Vercel, Google Wallet Generic Pass REST API, `google-auth-library`, Node `crypto`, Node test runner, Playwright/Chromium.

**Spec:** `docs/superpowers/specs/2026-10-09-google-wallet-membership-c4.md`

## Global Constraints

- BGM database/member-card state is the sole source of truth for identity, membership eligibility, card validity, and gym access.
- Wallet barcode value is always the current active physical-card credential, never the permanent BGM number.
- Wallet uses `GENERIC_GYM_MEMBERSHIP`; active barcode type is `CODE_128`.
- One stable Google object per immutable BGM member UUID; renewals/replacements update the same object.
- Membership expiry date itself remains valid for the whole Malta calendar day; Wallet expiry is the following Malta midnight.
- Future cancellation ends Wallet validity at the start of the cancellation-effective Malta date; use the earlier of cancellation midnight and post-expiry midnight.
- C1 seven-day app grace never extends Wallet access validity.
- Expired, cancelled, archived, inactive, or cardless states must not leave a prior scannable credential displayed as current.
- No Google `expiryNotification` or `upcomingNotification`; C3 remains the expiry-notification system.
- Member photo is never exported to Google Wallet in C4.
- TEST and Production use different class suffixes/object prefixes.
- No Google credential/config variable is `NEXT_PUBLIC_*`.
- BGM writes succeed independently of Google; Wallet failure never rolls back a successful membership/card mutation.
- Production schema, Production Google credentials, merge/deploy, and real-member issuance require separate explicit owner approval after TEST, full CI, and Preview verification.

## Server Configuration Contract

- `GOOGLE_WALLET_ENABLED`
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY`
- `GOOGLE_WALLET_CLASS_SUFFIX` — TEST `bgm_membership_test_v1`; Production `bgm_membership_v1`
- `GOOGLE_WALLET_OBJECT_PREFIX` — TEST `test_`; Production `prod_`
- `GOOGLE_WALLET_ORIGIN`
- `GOOGLE_WALLET_LOGO_URL`
- `GOOGLE_WALLET_APP_URL`

## Review Focus

- **DST boundary:** 23/25-hour Malta days still end at the correct local midnight — pinned in Task 1.
- **Scheduled cancellation:** already-synced pass expires automatically at cancellation-effective Malta midnight — pinned in Task 1.
- **Replacement during Google outage:** old BGM credential is invalid immediately while Wallet failure stays recoverable/non-blocking — pinned in Task 6.
- **Repeated/concurrent Add:** one deterministic object/mapping only — pinned in Tasks 2–4.
- **Credential leakage:** private key/token/raw Google error never reaches member response or client bundle — pinned in Tasks 3–5.

---

### Task 1: Pure Wallet membership projection and Malta validity

**Files:**
- Create: `lib/googleWalletCore.ts`
- Modify: `lib/maltaDate.ts`
- Create: `tests/google-wallet-core.test.mjs`

**Interfaces:**
- Add `maltaMidnightUtc(calendarDate: string): string` implemented as `maltaDayUtcRange(calendarDate).start`.
- Produce `GoogleWalletMemberSnapshot`, `GoogleWalletEligibilityReason`, `GoogleWalletProjection`.
- Produce:
  - `googleWalletClassId(issuerId, classSuffix)`
  - `googleWalletObjectId(issuerId, memberId, objectPrefix)`
  - `googleWalletValidityEnd(expiryDate, cancellationEffectiveDate)`
  - `projectGoogleWalletMember(snapshot, today)`

- [ ] **Step 1: Write RED tests** for deterministic IDs, expiry-day inclusion, effective/future cancellation, cardless/inactive/archive/expired states, current-card `CODE_128`, BGM-number-display-only behavior, and Malta DST boundaries.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/google-wallet-core.test.mjs` and confirm RED.
- [ ] **Step 3: Implement** the pure rules. Active projection includes `genericType: "GENERIC_GYM_MEMBERSHIP"`, member name, BGM member number, status text, DD/MM/YYYY display expiry, current card barcode, and calculated validity end. Inactive/expired projection must replace the old barcode with a non-access `TEXT_ONLY` status value.
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Commit** `lib/googleWalletCore.ts`, `lib/maltaDate.ts`, and its test.

### Task 2: Wallet mapping schema and pending-sync triggers

**Files:**
- Create: `supabase/migrations/20261009040000_google_wallet_membership_passes.sql`
- Create: `tests/google-wallet-schema-contract.test.mjs`

**Interfaces:**
- Create `bgm_google_wallet_passes` with: `member_id` PK/FK, unique `object_id`, `class_id`, `sync_status pending|synced|failed`, `last_attempt_at`, `last_synced_at`, `last_error`, timestamps.
- Enable RLS; revoke direct `anon`/`authenticated`; server/service-role only.
- `bgm_members` trigger marks an existing pass row pending when displayed/eligibility fields change: member number/name, status, expiry, cancellation date, archive state.
- `bgm_member_card_credentials` INSERT/UPDATE/DELETE trigger marks both OLD and NEW member IDs pending when applicable.
- Triggers update only existing pass rows; they never provision Wallet rows or call a network service.

- [ ] **Step 1: Write RED schema tests** for table shape, unique mapping, RLS/grants, watched fields, OLD+NEW card reassignment, and no trigger INSERT into the Wallet table.
- [ ] **Step 2: Run focused test RED.**
- [ ] **Step 3: Implement additive migration.**
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Apply migration to TEST Supabase only** and verify schema/RLS/defaults plus a fictional existing mapping becoming pending after member/card update. Verify an unrelated member with no mapping receives no mapping row.
- [ ] **Step 6: Commit.**

### Task 3: Server-only Google Wallet REST client and save JWT

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/googleWalletServer.ts`
- Create: `tests/google-wallet-server-contract.test.mjs`

**Interfaces:**
- Add only `google-auth-library`; use native `fetch` for Wallet REST and Node `crypto` for save JWT.
- OAuth scope: `https://www.googleapis.com/auth/wallet_object.issuer`.
- REST base: `https://walletobjects.googleapis.com/walletobjects/v1`.
- Produce `getGoogleWalletConfig`, `ensureGoogleWalletClass`, `upsertGoogleWalletObject`, `buildGoogleWalletSaveUrl`, `safeGoogleWalletError`.
- Save JWT claims are fixed: `iss=<service account email>`, `aud="google"`, `typ="savetowallet"`, `iat=<unix seconds>`, `origins=[GOOGLE_WALLET_ORIGIN]`, `payload.genericObjects=[{ id: objectId }]`.

- [ ] **Step 1: Run** `npm install google-auth-library` so the lockfile pins the resolved version.
- [ ] **Step 2: Write RED tests** using a generated ephemeral RSA keypair and mocked `fetch`: config validation/private-key `\\n` normalization, JWT claims/signature, class create-on-404, object create-on-404, PATCH existing object, safe error redaction.
- [ ] **Step 3: Run focused test RED.**
- [ ] **Step 4: Implement server-only module.** `GOOGLE_WALLET_ENABLED !== "true"` returns unavailable. The class has no Google expiry/upcoming notifications. Object payload explicitly owns/overwrites `state`, `genericType`, barcode, validity interval, card title/header/member number/status/expiry fields, BGM orange `#ff5a0a`, configured HTTPS logo, and configured app link; it contains no member photo.
- [ ] **Step 5: Run focused test GREEN and `npx tsc --noEmit`.**
- [ ] **Step 6: Commit.**

### Task 4: Canonical member snapshot, durable sync, and member API

**Files:**
- Create: `lib/googleWalletSync.ts`
- Create: `app/api/member/google-wallet/route.ts`
- Create: `tests/google-wallet-member-api.test.mjs`

**Interfaces:**
- `loadGoogleWalletMemberSnapshot(memberId)` loads BGM member state plus the latest active `bgm_member_card_credentials` row.
- `syncGoogleWalletPassForMember(memberId, { provision })` returns `synced|not_provisioned|unavailable|failed`; `provision:false` never creates a mapping, `provision:true` uses deterministic IDs and upserts one mapping.
- `bestEffortSyncGoogleWalletMembers(memberIds)` dedupes IDs, uses `provision:false`, records failure safely, and never throws into the BGM caller.
- GET `/api/member/google-wallet` => member-safe `{ available, eligible, reason, provisioned, syncStatus, lastSyncedAt }`.
- POST `/api/member/google-wallet` => require member session, enforce canonical eligibility, `provision:true`, synchronize, return `{ saveUrl }`.

- [ ] **Step 1: Write RED tests:** 401 session guard, unavailable config, archived/expired/effective-cancellation/cardless refusal, expiry-day eligibility, repeated POST idempotency, mapping `pending -> synced/failed`, no raw Google secret/error leakage, and `provision:false` no-row behavior.
- [ ] **Step 2: Run focused test RED.**
- [ ] **Step 3: Implement using** `getMemberRequestSession`, `getSupabaseAdmin`, `todayMaltaDate`, and current active-card credential source; never authorize from client cache/localStorage.
- [ ] **Step 4: Run focused test GREEN and typecheck.**
- [ ] **Step 5: Commit.**

### Task 5: Official Add to Google Wallet member UI

**Files:**
- Add unchanged current official Google SVG as: `public/google-wallet/add-to-google-wallet.svg`
- Create: `components/member/GoogleWalletButton.tsx`
- Modify: `components/member/MemberCard.tsx`
- Create: `tests/google-wallet-ui-contract.test.mjs`
- Modify: `tests/browser/member-card-gyms.mjs`

**Interfaces:**
- Wallet action is on the full member card only; compact home card is unchanged.
- Component GETs status, hides completely when unavailable, shows concise BGM reason when ineligible, POSTs once while loading, then navigates to returned `saveUrl`.
- Use the official asset unchanged; do not redraw a Google-branded button.

- [ ] **Step 1: Add official Google SVG unchanged.**
- [ ] **Step 2: Write RED contract tests** for asset path, endpoint paths, duplicate-click guard, full-card-only placement, and absence of server env/private-key references in client files.
- [ ] **Step 3: Extend existing `member-card-gyms.mjs` browser fixture** to mock GET/POST Wallet endpoints; verify eligible button, exactly one POST, intercepted navigation, unavailable hidden state, cardless/expired ineligible state, unchanged physical barcode/BGM-number separation, and 320/390px layout.
- [ ] **Step 4: Run focused contract test RED.**
- [ ] **Step 5: Implement UI.**
- [ ] **Step 6: Run** focused test, `npm run build`, then `node tests/browser/member-card-gyms.mjs` GREEN.
- [ ] **Step 7: Commit.**

### Task 6: Immediate non-blocking sync hooks after canonical BGM mutations

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
- Call `bestEffortSyncGoogleWalletMembers` only after the existing canonical mutation/RPC succeeds.
- Card replacement syncs `[memberId]`.
- Activation/renewal syncs `activationResult.data.members.map(row => row.memberId)`; the current activation RPC already returns that `members` array.
- Profile edit/date correction/individual cancellation/archive-restore sync `[memberId]`.
- Couples cancellation syncs `[memberId, validation.partnerId]`.
- No hook provisions a pass for a member who never requested one.

- [ ] **Step 1: Write RED contract tests** proving each hook occurs after success, never before its BGM RPC.
- [ ] **Step 2: Add behavior assertions** where sync rejects but the route still returns its existing successful business response. Card-replacement case must prove Google failure cannot undo the completed BGM replacement.
- [ ] **Step 3: Run focused test RED.**
- [ ] **Step 4: Implement minimal post-success hooks without changing existing transaction/RPC semantics.**
- [ ] **Step 5: Run Wallet hook test plus existing card replacement, cancellation, couples cancellation, archive/account, date-correction, and Super Admin editor tests GREEN.**
- [ ] **Step 6: Commit.**

### Task 7: Bounded Wallet recovery engine in the existing secured daily cron

**Files:**
- Create: `lib/googleWalletSyncEngine.ts`
- Modify: `app/api/cron/membership-expiry-reminders/route.ts`
- Create: `tests/google-wallet-sync-engine.test.mjs`
- Modify: `tests/member-engagement-engine-contract.test.mjs`
- Modify: `tests/membership-reminders-contract.test.mjs`

**Interfaces:**
- `runGoogleWalletRecoverySync({ pageSize = 25 })`; clamp page size to `1..50`.
- Select only provisioned mappings with `sync_status in ('pending','failed')`, oldest `updated_at` first, max 25 by default per cron run.
- Call `syncGoogleWalletPassForMember(memberId, { provision:false })` per row with per-member isolation.
- Return `{ examined, synced, failed, skipped }`.
- Existing cron adds independent `googleWalletSync` outcome beside `membershipReminders` and `memberEngagement`; no new Vercel cron entry and existing `CRON_SECRET`/runtime/maxDuration remain.

- [ ] **Step 1: Write RED tests** for bounded selection/order, pending/failed-only processing, no provisioning, one-member failure isolation, and independent cron outcomes.
- [ ] **Step 2: Run focused test RED.**
- [ ] **Step 3: Implement engine and third `runEngine(...)` call.**
- [ ] **Step 4: Run focused Wallet + existing cron/engagement/reminder tests GREEN.**
- [ ] **Step 5: Commit.**

### Task 8: TEST integration and full regression verification

**Files:**
- Create: `docs/google-wallet-test-rollout.md`
- No CI workflow edit is needed: Wallet browser coverage lives in `tests/browser/member-card-gyms.mjs`, which Phase 2 CI already runs.

**Interfaces:**
- CI uses mocks + ephemeral RSA key only; no real Google credential required in GitHub Actions.
- TEST uses dedicated TEST issuer class/object namespace and a fictional TEST member.

- [ ] **Step 1: Write TEST rollout doc** with exact environment variable names and operator steps; never include secret values.
- [ ] **Step 2: Run full verification:** `node --experimental-strip-types --test tests/*.test.mjs`, `npx tsc --noEmit`, `npm run build`, then every browser script currently listed in `.github/workflows/phase2-ci.yml`.
- [ ] **Step 3: Configure TEST Google Wallet credentials only after code/tests are green.** User enters secrets directly in Vercel; verify presence/scope without exposing values.
- [ ] **Step 4: Manual TEST integration with one fictional active TEST member:** first Add/save; second Add reuses same object; card replacement patches same object; renewal extends same object; scheduled cancellation has correct future Malta end; archive/effective cancellation/cardless becomes non-scannable; pending/failed recovery re-syncs without duplicate object.
- [ ] **Step 5: Run TEST Supabase advisors/security review** and verify RLS/server-only grants.
- [ ] **Step 6: Commit rollout documentation.**

### Task 9: Final branch verification, Draft PR, and Production approval gate

**Files:**
- No mandatory new product file.

- [ ] **Step 1: Re-run full node suite, typecheck, production build, and all Phase 2 browser checks on final branch head.**
- [ ] **Step 2: Verify Vercel Preview READY and inspect build/runtime evidence; do not invoke any Production cron or issue any real-member pass.**
- [ ] **Step 3: Re-read C4 spec against final code/tests** and explicitly verify physical-card barcode reuse, stable object ID, Malta expiry/cancellation semantics, inactive non-scannable state, no photo, no Google expiry notifications, no secret leakage, non-blocking BGM mutations, bounded recovery, and TEST/Production namespace separation.
- [ ] **Step 4: Open C4 PR to `main` as Draft** with TEST evidence, migration summary, required Production env names, and explicit statement that Production is unchanged.
- [ ] **Step 5: Present exact Production rollout for owner approval**, separately listing: additive Production migration; Production Google issuer/service-account/Vercel secret configuration; Production class/object namespace; PR merge/deploy; expected normal-cron behavior for already-provisioned mappings; and the fact that no manual Production cron trigger will occur without separate approval.
- [ ] **Step 6: STOP.** Do not migrate Production, configure Production Google secrets, merge the PR, or issue a real-member pass without explicit owner approval.
