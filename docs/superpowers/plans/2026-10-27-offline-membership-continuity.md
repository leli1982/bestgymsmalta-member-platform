# Offline Membership Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep new-membership sales operational during internet outages, synchronize them safely afterward, and give `/join` customers an immediate reception handoff when the tablet is offline.

**Architecture:** Reuse the existing Staff registration form with an IndexedDB-backed cached configuration and offline sale queue. A reconnect bridge posts queued sales to an authenticated idempotent server endpoint, which revalidates identity/card/config state and either activates centrally or creates a review-required application. The public tablet remains network-only and switches to a blocking offline notice. Online and offline activations share the existing welcome-package path, extended to include the permanent BGM number.

**Tech Stack:** Next.js/React/TypeScript, IndexedDB, existing Staff service worker/PWA, Supabase/PostgreSQL/Storage, Node contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-27-offline-membership-continuity-addendum.md`

## Global Constraints

- Work on `feature/tablet-enrollment-membership-settings`; Vercel auto-deploy is already disabled for this branch.
- TEST Supabase only (`vlvyqdjhzdcxatilbdiv`) until explicit Production approval.
- Do not touch Punch Clock/biometric code.
- `/join/*` remains online-only.
- No permanent BGM number is allocated offline.
- Offline sale date/time is authoritative for membership commercial start.
- Physical cards may be issued offline but are provisional until server sync.
- Local queued PII is removed only after a persisted server receipt.
- Sync is idempotent by `clientSubmissionId`.
- Welcome email is sent only after central activation/permanent member-number assignment and cannot be duplicated by retries.

## Review Focus

- Browser reports online but the API is unreachable: staff must be offered offline save without losing the completed form.
- Reconnect fires repeatedly: one queued sale must never activate twice or send duplicate welcome mail.
- Same card is issued at two disconnected gyms: both local sales survive; server flags conflict rather than losing either sale.
- Staff session expires during outage: queue survives and sync resumes after login.
- Tablet loses connection midway through a form: form becomes blocked with front-desk instruction and must never submit stale data silently.

---

### Task 1: Tablet offline handoff

**Files:**
- Modify: `components/membership/JoinEnrollmentPage.tsx`
- Modify: `tests/tablet-enrollment-pwa-contract.test.mjs`

**Interfaces:**
- Consumes existing `online` state from `navigator.onLine` + browser online/offline events.
- Produces a blocking offline surface and hides the public registration form while offline.

- [ ] **Step 1: Write failing contract assertions** for `SYSTEM OFFLINE`, front-desk/reception instruction, and form rendering gated by `online`.
- [ ] **Step 2: Run the contract and confirm RED.**
- [ ] **Step 3: Implement the blocking offline surface using the existing network state.**
- [ ] **Step 4: Run the contract and confirm GREEN.**
- [ ] **Step 5: Commit.**

---

### Task 2: Offline config and local sale queue

**Files:**
- Create: `lib/offlineMembershipQueue.ts`
- Modify: `components/staff/MembershipEnrollmentPage.tsx`
- Modify: `public/staff-sw.js`
- Create: `tests/offline-membership-queue.test.mjs`
- Create: `tests/staff-offline-membership-ui-contract.test.mjs`

**Interfaces:**
- Produces `cacheOfflineEnrollmentContext(config, staffContext)` and `loadOfflineEnrollmentContext(gymId)`.
- Produces `enqueueOfflineMembership`, `listOfflineMemberships`, `updateOfflineMembershipState`, and `removeOfflineMembership`.
- Offline records store `clientSubmissionId`, `offlineReference`, gym, `soldAt`, cached config, registration draft, photo blobs, physical card(s), payment, staff name and verification snapshot.

- [ ] **Step 1: Write failing queue/UI/service-worker tests.**
- [ ] **Step 2: Run them and confirm RED.**
- [ ] **Step 3: Implement IndexedDB config + queue with no `localStorage` PII.**
- [ ] **Step 4: Cache Staff enrollment configuration after successful online load and extend Staff shell caching for the enrollment route.**
- [ ] **Step 5: Add offline checkout after the normal registration form: payment method, physical card(s), verification confirmations, save-offline action and operational receipt.**
- [ ] **Step 6: On network failure after a completed form, retain the draft and offer Save Offline rather than discarding it.**
- [ ] **Step 7: Run tests and confirm GREEN.**
- [ ] **Step 8: Commit.**

---

### Task 3: Server idempotency and synchronization

**Files:**
- Create: `supabase/migrations/<generated>_offline_membership_sync.sql`
- Create: `app/api/system/members/offline-sync/route.ts`
- Create: `lib/offlineMembershipSyncCore.ts`
- Create: `tests/offline-membership-sync-schema.test.mjs`
- Create: `tests/offline-membership-sync-core.test.mjs`
- Create: `tests/offline-membership-sync-api-contract.test.mjs`

**Interfaces:**
- Creates `bgm_offline_membership_sync_receipts` keyed uniquely by `client_submission_id`.
- `POST /api/system/members/offline-sync` accepts queued sale payload plus optional photos.
- Returns persisted `activated | review_required | rejected` outcome and permanent member numbers only for activated results.

- [ ] **Step 1: Write failing schema/core/API tests.**
- [ ] **Step 2: Run and confirm RED.**
- [ ] **Step 3: Add receipt migration with RLS/privilege hardening appropriate to server-only access.**
- [ ] **Step 4: Implement pure outcome decision rules.**
- [ ] **Step 5: Implement authenticated sync endpoint: receipt-first idempotency, historical config validation, duplicate/card recheck, server application persistence and central activation.**
- [ ] **Step 6: Preserve the offline `soldAt` date as activation start-date input; never substitute reconnect time.**
- [ ] **Step 7: Apply/verify schema on TEST Supabase only.**
- [ ] **Step 8: Run tests and confirm GREEN.**
- [ ] **Step 9: Commit.**

---

### Task 4: Automatic reconnect + welcome package

**Files:**
- Create: `components/staff/OfflineMembershipSyncBridge.tsx`
- Modify: existing Staff shell/dashboard mount point
- Modify: `lib/welcomeEmailCore.ts`
- Modify: `lib/welcomePackage.ts`
- Modify: `tests/welcome-package.test.mjs`
- Create: `tests/offline-membership-sync-bridge-contract.test.mjs`

**Interfaces:**
- Bridge serially synchronizes queued records on `online` and on Staff startup when online.
- `401` keeps record and marks `needs_login`; network/5xx keeps record; persisted server outcomes remove local PII.
- `WelcomeEmailInput` gains `memberNumber` and renders it in text + HTML.
- Offline activated result invokes the same `sendWelcomePackagesBestEffort(applicationId)` path used by online activation.

- [ ] **Step 1: Write failing bridge + welcome-email tests.**
- [ ] **Step 2: Run and confirm RED.**
- [ ] **Step 3: Implement serial reconnect bridge with mutex and visible queue/outcome state.**
- [ ] **Step 4: Extend welcome package lookup to resolve each activated participant's permanent BGM number and pass it to the shared email builder.**
- [ ] **Step 5: Trigger the shared welcome package only after successful offline activation.**
- [ ] **Step 6: Run tests and confirm GREEN.**
- [ ] **Step 7: Commit.**

---

### Task 5: Full verification

**Files:**
- Modify/add browser tests only if needed to exercise the final flow.

- [ ] **Step 1: Run all Node tests.**
- [ ] **Step 2: Run `npx tsc --noEmit`.**
- [ ] **Step 3: Run `NEXT_TELEMETRY_DISABLED=1 npm run build`.**
- [ ] **Step 4: Verify branch has no Vercel deployment.**
- [ ] **Step 5: Inspect TEST invariants: unique receipt per client submission, no duplicate BGM numbers, no duplicate active cards, queued sale start dates preserved.**
- [ ] **Step 6: Leave Production untouched and report exact TEST/CI evidence before any merge/deploy discussion.**
