# Offline Continuity & Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an already-used Staff terminal capture and take payment for new memberships during an internet outage, then safely synchronize to Supabase without ever allocating permanent BGM numbers or final card ownership locally.

**Architecture:** Cache only the published enrollment configuration and queued staff applications in origin-scoped IndexedDB. Offline records use a random client submission UUID, immutable cached price/declaration version IDs, optional WebP photo blobs and a pending card value. On reconnect an authenticated sync endpoint processes each UUID idempotently, reruns duplicate/card/settings checks and either activates centrally or persists a server-side application requiring staff review. Successful/accepted server receipts delete the local PII copy.

**Tech Stack:** Next.js/React/TypeScript, IndexedDB, existing Staff service worker/PWA, Supabase/PostgreSQL/Storage, Node tests, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md`

## Global Constraints

- Customer/tablet `/join/*` remains online-only. Offline enrollment exists only in authenticated Staff surfaces.
- Offline capture is allowed only after that browser has successfully loaded Staff auth + enrollment config while online.
- No permanent membership number is generated, guessed, reserved or displayed offline.
- Physical card entered offline is `PENDING CONFIRMATION` until Supabase confirms it is unused.
- Offline discount codes are disabled; applying/consuming a code requires online validation.
- Offline payment is recorded as pending online activation, not represented as a completed server membership.
- Cached price/declaration versions are immutable historical version IDs. Sync honors a version that was genuinely published when cached; it never silently swaps to a newer price.
- If cached version IDs/hashes cannot be verified, sync creates/holds a review item rather than silently repricing or changing declarations.
- Active duplicate ID, card conflict or returning expired/inactive member never auto-creates a duplicate. The server persists a review-required application.
- Local PII/photo blobs are deleted immediately after a server receipt confirms the application is persisted/activated. Failed/unconfirmed records remain queued.
- Sync requires a live authenticated Staff system session. If session expired, prompt login and retry; never drop queued records.
- Permanent identity allocation remains inside the existing central transaction, preventing cross-gym duplicate membership numbers.

---

### Task 1: Add server-side idempotency receipts for offline sync

**Files:**
- Create: `supabase/migrations/20260916_150000_offline_membership_sync.sql`
- Create: `tests/offline-membership-sync-schema.test.mjs`

**Interfaces:**
- Produces table `bgm_offline_membership_sync_receipts`.
- Produces RPC/helper contract used by sync endpoint to claim one `client_submission_id` exactly once.

- [ ] **Step 1: Write RED schema contract**

Require:

```js
assert.match(sql, /create table public\.bgm_offline_membership_sync_receipts/i);
assert.match(sql, /client_submission_id uuid/i);
assert.match(sql, /unique.*client_submission_id/i);
assert.match(sql, /source_gym_id/i);
assert.match(sql, /result.*activated.*review_required/i);
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/offline-membership-sync-schema.test.mjs
```

- [ ] **Step 3: Implement receipt table**

Canonical fields:

```sql
create table public.bgm_offline_membership_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null unique,
  source_gym_id text not null references public.bgm_gyms(id),
  system_user_id uuid not null references public.bgm_system_users(id),
  application_id uuid references public.bgm_membership_applications(id),
  result text not null check (result in ('activated','review_required','rejected')),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Revoke anon/authenticated access; service role only. Idempotency is based solely on `client_submission_id`, never member name/card value.

- [ ] **Step 4: Apply to development Supabase, run GREEN and commit**

```bash
node --test tests/offline-membership-sync-schema.test.mjs
git add supabase/migrations/20260916_150000_offline_membership_sync.sql tests/offline-membership-sync-schema.test.mjs
git commit -m "feat: add offline membership sync idempotency"
```

---

### Task 2: Implement the local offline membership queue

**Files:**
- Create: `lib/offlineMembershipQueue.ts`
- Create: `tests/offline-membership-queue.test.mjs`

**Interfaces:**

```ts
export type OfflineMembershipRecord = {
  clientSubmissionId: string;
  gymId: string;
  createdAt: string;
  cachedConfig: {
    priceCatalogVersionId: string;
    declarationVersionIds: { gymRules: string; privacy: string; health: string; guardian?: string };
  };
  registration: RegistrationDraft;
  pendingCardValues: string[];
  payment: { method: "cash" | "card" | "other"; otherText?: string; staffName: string };
  verifications: OfflineVerificationSnapshot;
  photos: Array<Blob | null>;
  state: "queued" | "syncing" | "needs_login" | "error";
};

export async function enqueueOfflineMembership(record: OfflineMembershipRecord): Promise<void>;
export async function listOfflineMemberships(): Promise<OfflineMembershipRecord[]>;
export async function updateOfflineMembershipState(id: string, state: OfflineMembershipRecord["state"]): Promise<void>;
export async function removeOfflineMembership(id: string): Promise<void>;
```

- [ ] **Step 1: Write RED tests using a fake IndexedDB implementation already available in test setup, or a minimal injected storage adapter**

Tests must cover queue/list/update/delete, persistence of WebP Blob metadata, and no use of `localStorage`.

- [ ] **Step 2: Implement IndexedDB store**

Database name `bgm-staff-offline`, object store `membership-enrollment-v1`, keyPath `clientSubmissionId`. Never serialize Blob bytes into JSON/localStorage.

- [ ] **Step 3: Add age-based cleanup helper**

Do not auto-delete unsynced valid records. Only purge local records older than 30 days after a prominent staff confirmation, or delete automatically once a server receipt is stored. The default startup behavior lists stale records for attention rather than discarding them.

- [ ] **Step 4: GREEN and commit**

```bash
node --experimental-strip-types --test tests/offline-membership-queue.test.mjs
git add lib/offlineMembershipQueue.ts tests/offline-membership-queue.test.mjs
git commit -m "feat: add staff offline membership queue"
```

---

### Task 3: Cache an offline-safe enrollment configuration while online

**Files:**
- Create: `lib/offlineEnrollmentConfig.ts`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Create: `tests/offline-enrollment-config.test.mjs`

**Interfaces:**

```ts
export type CachedOfflineEnrollmentConfig = {
  gymId: string;
  gymName: string;
  cachedAt: string;
  priceCatalogVersionId: string;
  prices: PriceEntry[];
  declarations: PublishedDeclarationSnapshot[];
  systemUserId: string;
  displayName: string;
};
```

- [ ] **Step 1: RED tests**

Require cached config only after a successful `/api/system/auth` and settings/config load; require gym ID to equal the authenticated account gym; reject cache use for a different gym.

- [ ] **Step 2: Implement IndexedDB config store**

Store no password/session cookie and no member roster. Cache only the values needed to display the form and prove which immutable price/declaration versions were shown.

- [ ] **Step 3: Add `Offline enrollment ready` state to Staff UI**

When online and cache current, show a small success indicator. When cache missing, Staff must be told to open enrollment once while online before relying on outage mode.

- [ ] **Step 4: GREEN and commit**

```bash
node --experimental-strip-types --test tests/offline-enrollment-config.test.mjs tests/staff-shared-registration-contract.test.mjs
git add lib/offlineEnrollmentConfig.ts components/staff/MembershipEnrollmentPage.tsx tests/offline-enrollment-config.test.mjs
git commit -m "feat: cache staff enrollment config for outages"
```

---

### Task 4: Enable Staff offline capture and pending receipt UI

**Files:**
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Create: `components/staff/OfflineMembershipStatus.tsx`
- Modify: `components/staff/StaffDashboard.tsx`
- Modify: `public/staff-sw.js`
- Create: `tests/staff-offline-membership-ui-contract.test.mjs`

**Interfaces:**
- Offline Staff uses the same `RegistrationForm mode="staff"` with cached config.
- Offline completion calls `enqueueOfflineMembership`, not an API.
- Produces visible temporary reference `OFFLINE-<short uuid>` and status `PENDING ONLINE ACTIVATION`.

- [ ] **Step 1: Write RED UI/service-worker contract**

Require visible `OFFLINE MODE`, queue count, `PENDING ONLINE ACTIVATION`, `CARD PENDING CONFIRMATION`, no permanent BGM number, and service-worker shell support for `/staff/members/enroll`.

- [ ] **Step 2: Extend staff service-worker shell cache**

Increment cache version. Include `/staff/members/enroll`; continue excluding `/api/*`. Keep cache limited to shell/static GET responses, never POST bodies or enrollment data.

- [ ] **Step 3: Implement offline submit branch**

When `navigator.onLine === false` or online submit fails with a network error, and a valid cached config exists, staff may explicitly choose **Save Offline**. Generate `crypto.randomUUID()`; store registration/payment/verifications/card(s)/optional WebP photo blobs.

Disable discount-code field offline with text `Discount codes require an internet connection.`

- [ ] **Step 4: Show pending receipt**

Display temporary reference, paid amount/method, pending card value(s), photo state, and clear wording: `No permanent BGM membership number has been issued yet.` Staff may print this temporary operational receipt, but it must not resemble the final member card/form.

- [ ] **Step 5: Dashboard queue counter**

`StaffDashboard` shows `N applications waiting to sync`. Clicking opens the offline list with created time, member name and current local sync state.

- [ ] **Step 6: GREEN and commit**

```bash
node --experimental-strip-types --test tests/staff-offline-membership-ui-contract.test.mjs tests/offline-membership-queue.test.mjs
git add components/staff/MembershipEnrollmentPage.tsx components/staff/OfflineMembershipStatus.tsx components/staff/StaffDashboard.tsx public/staff-sw.js tests/staff-offline-membership-ui-contract.test.mjs
git commit -m "feat: capture staff memberships during outages"
```

---

### Task 5: Build authenticated idempotent offline sync endpoint

**Files:**
- Create: `app/api/system/members/offline-sync/route.ts`
- Create: `lib/offlineMembershipSyncCore.ts`
- Create: `tests/offline-membership-sync-core.test.mjs`
- Create: `tests/offline-membership-sync-api-contract.test.mjs`

**Interfaces:**
- `POST /api/system/members/offline-sync` accepts multipart `payload` + optional `photo0`/`photo1`.
- Result:

```ts
{
  ok: true;
  clientSubmissionId: string;
  result: "activated" | "review_required" | "rejected";
  applicationId: string;
  memberNumbers?: string[];
  reason?: "active_identity" | "possible_renewal" | "card_conflict" | "stale_config" | "verification_required";
}
```

- [ ] **Step 1: Write RED pure decision tests**

`decideOfflineSyncOutcome` must produce:

- clear identities + cards free + verification complete -> `activate`;
- any active identity -> `review_required(active_identity)`;
- expired/inactive identity -> `review_required(possible_renewal)`;
- any card conflict -> `review_required(card_conflict)`;
- cached version/hash cannot be proven -> `review_required(stale_config)`;
- missing required verification -> `review_required(verification_required)`.

- [ ] **Step 2: Implement core decision function**

It is pure and never allocates numbers.

- [ ] **Step 3: Write RED API contract**

Require `requireSystemPermission`, authenticated gym equality, lookup of existing receipt before work, historical price/declaration version validation, no discount support, duplicate/card recheck, receipt insert and reuse of central activation RPC.

- [ ] **Step 4: Implement idempotency first**

On request, load receipt by `client_submission_id`. If found and same gym/account scope is valid, return stored `result_payload`; do not create/activate again.

- [ ] **Step 5: Verify cached immutable configuration**

Load exact historical `priceCatalogVersionId` and declaration IDs/hashes. Accept a version that was genuinely published/retired after publication and whose content/price matches the cached submission. Do not require it to still be current. Reject/hold if IDs/hashes/price do not match.

- [ ] **Step 6: Recheck identity and card centrally**

Do not trust offline duplicate/card state. Any active identity or card conflict becomes a normal server-side pending application with `review_required`; no permanent number is allocated. Expired/inactive identity stores the matched member on the participant for possible renewal review.

- [ ] **Step 7: Auto-activate only clean new applications**

For a clear new application with completed verification/payment and free card(s), persist application/photo(s), then invoke `bgm_activate_membership_application`. That RPC centrally allocates permanent member number(s). Insert idempotency receipt in the same DB transaction boundary where possible; if an unavoidable Storage step precedes DB commit, make retries safe by deterministic application/client IDs and cleanup.

- [ ] **Step 8: GREEN and commit**

```bash
node --experimental-strip-types --test tests/offline-membership-sync-core.test.mjs tests/offline-membership-sync-api-contract.test.mjs
git add app/api/system/members/offline-sync/route.ts lib/offlineMembershipSyncCore.ts tests/offline-membership-sync-core.test.mjs tests/offline-membership-sync-api-contract.test.mjs
git commit -m "feat: safely synchronize offline memberships"
```

---

### Task 6: Add automatic reconnect sync with login recovery

**Files:**
- Create: `components/staff/OfflineMembershipSyncBridge.tsx`
- Modify: `components/staff/StaffDashboard.tsx`
- Modify: `components/AppShell.tsx` or the existing Staff shell component only at the point where the Staff service worker/realtime bridge is mounted.
- Create: `tests/offline-membership-sync-bridge-contract.test.mjs`

**Interfaces:**
- Sync bridge listens for browser `online` event and runs queue serially.
- HTTP 401 -> mark `needs_login`, preserve record, show login-required banner.
- `activated|review_required|rejected` with persisted server receipt -> remove local record after showing/saving outcome in UI.
- network/5xx -> keep local record as `error`, retry manually or on next reconnect.

- [ ] **Step 1: Write RED contract**

Require serial processing (not `Promise.all`), local deletion only after an explicit persisted server result, and no deletion on 401/network failure.

- [ ] **Step 2: Implement sync bridge**

Use a module-level/in-component mutex so multiple `online` events cannot sync the same queue concurrently. Mark each item `syncing` before request.

- [ ] **Step 3: Add visible outcomes**

Activated: show permanent member number(s). Review required: tell reception why and link/open the server-side waiting application. Login required: button routes to existing Staff login and queued count remains.

- [ ] **Step 4: GREEN and commit**

```bash
node --experimental-strip-types --test tests/offline-membership-sync-bridge-contract.test.mjs tests/offline-membership-queue.test.mjs
git add components/staff/OfflineMembershipSyncBridge.tsx components/staff/StaffDashboard.tsx tests/offline-membership-sync-bridge-contract.test.mjs
git commit -m "feat: auto-sync offline memberships on reconnect"
```

---

### Task 7: Prove cross-gym number/card safety and offline browser behavior

**Files:**
- Modify: `tests/browser/staff-dashboard.mjs`
- Create: `tests/offline-membership-concurrency-contract.test.mjs`

- [ ] **Step 1: Add database/concurrency contract**

The test must assert permanent number allocation still occurs only inside the existing central activation allocator/RPC and that no offline client file contains a `nextMemberNumber`, number range or gym prefix allocation scheme.

- [ ] **Step 2: Add idempotency retry case**

Submit the same `clientSubmissionId` twice; verify the second response resolves the stored receipt and never invokes activation a second time.

- [ ] **Step 3: Add two-gym conceptual concurrency fixture**

Create two offline records with distinct UUIDs for different gyms and simulate server sync interleaving. Assert both call the same central allocator and receive distinct server-returned member numbers; no number is derived in client code.

- [ ] **Step 4: Browser offline/reconnect test**

In Chromium: load Staff while online, cache config, switch context offline, create a new membership with Photo Later, verify temporary ref and queue count, restore network, mock authenticated sync success, verify queue clears and permanent number appears only after response.

- [ ] **Step 5: Commit**

```bash
node --experimental-strip-types --test tests/offline-membership-concurrency-contract.test.mjs
npm run build
node tests/browser/staff-dashboard.mjs
git add tests/offline-membership-concurrency-contract.test.mjs tests/browser/staff-dashboard.mjs
git commit -m "test: prove offline enrollment synchronization safety"
```

---

### Task 8: Full verification and local release-candidate walkthrough

- [ ] **Step 1: Run complete test suite**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/member-card-gyms.mjs
node tests/browser/staff-dashboard.mjs
node tests/browser/tablet-enrollment.mjs
```

- [ ] **Step 2: Verify Git state**

```bash
git status --short
git log --oneline --decorate -12
```

Expected: clean working tree; only intentional feature commits on top of the stacked staff branch.

- [ ] **Step 3: Real two-device local test through HTTPS tunnel**

Run the built/dev app locally, expose with Cloudflare Quick Tunnel, and use a tablet plus reception computer. Test:

1. Tablet Regular application -> Staff queue -> activate.
2. Student -> document warning -> verification -> activate.
3. Couples -> two photos/two cards/two A4 sheets -> atomic activate.
4. Expired member -> possible-renewal conversion -> keep existing card.
5. Staff New Membership -> Photo Later -> activate -> scan grants entry + warns -> webcam capture -> next scan no warning.
6. Disconnect internet -> Staff offline new member/payment/card pending -> reconnect -> Supabase sync -> permanent number appears only after server success.
7. Simulate card conflict/active duplicate during offline period -> reconnect -> review-required, no duplicate member/number.

Stop the tunnel afterward.

- [ ] **Step 4: Inspect development Supabase invariants**

Verify no duplicate permanent member numbers, no duplicate active barcode credentials, discount counts equal successful activations, application snapshots point to immutable versions, and synced offline rows each have one idempotency receipt.

- [ ] **Step 5: Use `superpowers:verification-before-completion`**

Do not claim completion from memory. Record actual command/CI outputs.

---

### Task 9: Deliberate Preview and merge sequencing

- [ ] **Step 1: Check Vercel storage/usage before any Preview**

If storage meter still makes another Preview undesirable, do not deploy; continue using local HTTPS testing.

- [ ] **Step 2: If allowed, create exactly one deliberate release-candidate Preview**

The feature branch is normally suppressed, so use the deliberate deployment mechanism only after all local/CI checks are green. No repeated cosmetic Preview deployments.

- [ ] **Step 3: User visual acceptance**

User verifies tablet, Staff queue/review popup, print output, PHOTO REQUIRED behavior and offline flow. Do not merge without explicit approval.

- [ ] **Step 4: Respect stacked PR order**

Because this branch depends on PR #9, merge order is:

1. Explicit approval for Staff Dashboard PR #9 -> merge PR #9 to `main` and verify Production/CI.
2. Rebase/retarget enrollment branch onto updated `main` without rewriting validated feature behavior.
3. Run full verification again.
4. Only after separate explicit approval, merge enrollment PR.

If the user chooses to keep both slices together instead, do not improvise a merge; present the exact combined diff/PR strategy for approval first.