# Staff Dashboard & Reception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current menu-like `/staff` page with an always-open, gym-scoped reception dashboard that can browse/search members, receive pending membership applications in real time, review/correct them, assign cards, activate on payment, and print a filing form.

**Architecture:** Preserve the existing BGM custom system session, membership application tables, card-reservation logic, activation RPC, photo lifecycle and audit log. Add focused staff-dashboard APIs and components around them. Supabase Realtime Broadcast is used only as a refresh signal on an opaque gym-specific topic; the browser never receives member/application data from Realtime and always refetches through authenticated gym-scoped APIs.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Postgres/Realtime/Storage, `@supabase/supabase-js` 2.110+, Lucide icons, Node test runner, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-15-staff-dashboard-reception-design.md`

## Global Constraints

- Production baseline at planning time: `befc91d2e26e99acb389dd39f5ad4bb614a49473`.
- Each gym uses one shared username/password and the authenticated `bgm_system_users.gym_id` is authoritative.
- Normal staff must never be able to select or override their gym in a privileged request.
- Existing member-side auth, card, check-in, passport, trainer, progress and story behaviour must not change.
- Existing barcode/card reservation conflict logic must be reused.
- Existing activation rule remains: photo + assigned/verified card are required before activation.
- **Payment Received = activation**; there is no separate Activate Member action.
- Payment confirmation requires an individual staff name.
- New application submission, payment and activation timestamps are server-generated; UI/print display uses `Europe/Malta`.
- Staff may correct pending application data; established member browsing remains read-only in this phase.
- Original submitted application values must remain reconstructable through the audit trail.
- Realtime payloads contain no member/application PII; they only tell the dashboard to refetch.
- The pending queue must recover after refresh/reconnect because Postgres remains the source of truth.
- The dashboard is desktop-first, responsive to tablet, icon-first, high contrast and minimal-text.
- BGM visual language: light grey/off-white background, white cards, black/zinc text, BGM orange around `#ff5a0a`, green success, red invalid/expired.
- Do not introduce NFC into this workflow; barcode/QR remains the agreed credential scope.
- No database migration is required for this slice unless implementation discovers a genuine blocker; use the existing application, participant, audit, card and membership tables.
- Node 22 is the CI runtime; tests run with `node --experimental-strip-types --test tests/*.test.mjs`.
- Before implementation, create an isolated feature branch/worktree from the current `main` SHA.

---

## File Structure

### New files

- `lib/staffDashboardCore.ts` — pure status/filter/queue/date helpers shared by server/UI tests.
- `lib/staffRealtime.ts` — server-only gym topic derivation and refresh-only Supabase Broadcast helper.
- `lib/supabaseStaffBrowser.ts` — browser-only factory for the public Supabase Realtime client.
- `app/api/system/staff/realtime/route.ts` — authenticated delivery of the current gym's opaque Realtime topic plus safe public connection config.
- `app/api/system/members/applications/route.ts` — gym-scoped pending application queue endpoint.
- `app/api/system/members/applications/[applicationId]/route.ts` — gym-scoped application detail + correction endpoint.
- `app/api/system/members/applications/[applicationId]/print/route.ts` — gym-scoped printable snapshot + print-request audit endpoint.
- `app/staff/applications/[applicationId]/print/page.tsx` — dedicated A4 print surface.
- `components/staff/StaffDashboard.tsx` — top-level always-open reception workspace.
- `components/staff/StaffMemberBrowser.tsx` — search, filters, list and read-only member detail.
- `components/staff/StaffMembershipQueue.tsx` — waiting queue and arrival state.
- `components/staff/StaffMembershipReviewModal.tsx` — editable application review + three primary actions.
- `components/staff/StaffRealtimeBridge.tsx` — subscribes to refresh-only Broadcast events and reports connection state.
- `components/staff/StaffApplicationPrint.tsx` — print-only A4 layout.
- `tests/staff-dashboard-core.test.mjs` — pure helper tests.
- `tests/staff-dashboard-api-contract.test.mjs` — source/API security and routing contracts.
- `tests/staff-dashboard-ui-contract.test.mjs` — UI architecture/copy/action contracts.
- `tests/browser/staff-dashboard.mjs` — Playwright desktop/tablet workflow verification with mocked APIs.

### Existing files to modify

- `components/staff/StaffLoginPage.tsx` — retain login/session handling; render the new `StaffDashboard` after authentication.
- `app/api/system/members/search/route.ts` — add ID-number search, blank-query browsing, pagination and server-side status filtering.
- `app/api/system/members/enroll/route.ts` — preserve full submission snapshot in audit and broadcast queue refresh after create/activate.
- `app/api/system/members/card/assign/route.ts` — broadcast queue refresh after successful card reserve/verification.
- `.github/workflows/phase2-ci.yml` — add Staff Dashboard browser verification and screenshot artifact path.

### Existing files explicitly preserved

- `lib/systemAuth.ts`
- `lib/systemAuthCore.ts`
- `lib/barcodeAccessCore.ts`
- `lib/memberCardCredentialCore.ts`
- `components/staff/BarcodeReceptionPage.tsx`
- activation RPC in `supabase/migrations/20260910_113500_renewal_card_verification.sql`
- member-facing routes/components

---

### Task 1: Add pure Staff Dashboard status, filtering and time helpers

**Files:**
- Create: `lib/staffDashboardCore.ts`
- Create: `tests/staff-dashboard-core.test.mjs`
- Reuse: `lib/barcodeAccessCore.ts`

**Interfaces:**
- Produces: `type StaffMemberFilter = "all" | "active" | "expired"`.
- Produces: `classifyStaffMember({ status, membershipExpiry, today }): "active" | "expired" | "inactive"`.
- Produces: `matchesStaffMemberFilter(classification, filter): boolean`.
- Produces: `sortPendingApplicationsNewestFirst<T extends { submittedAt: string | null; createdAt: string }>(items): T[]`.
- Produces: `formatMaltaDateTime(value: string | Date): string`.

- [ ] **Step 1: Write the failing helper tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStaffMember,
  matchesStaffMemberFilter,
  sortPendingApplicationsNewestFirst,
  formatMaltaDateTime,
} from "../lib/staffDashboardCore.ts";

test("staff member classification matches reception access rules", () => {
  assert.equal(classifyStaffMember({ status: "active", membershipExpiry: "2026-09-15", today: "2026-09-15" }), "active");
  assert.equal(classifyStaffMember({ status: "active", membershipExpiry: "2026-09-14", today: "2026-09-15" }), "expired");
  assert.equal(classifyStaffMember({ status: "inactive", membershipExpiry: "2027-01-01", today: "2026-09-15" }), "inactive");
});

test("active and expired filters do not mislabel inactive members", () => {
  assert.equal(matchesStaffMemberFilter("active", "active"), true);
  assert.equal(matchesStaffMemberFilter("expired", "expired"), true);
  assert.equal(matchesStaffMemberFilter("inactive", "expired"), false);
  assert.equal(matchesStaffMemberFilter("inactive", "all"), true);
});

test("pending applications sort newest first", () => {
  const sorted = sortPendingApplicationsNewestFirst([
    { id: "old", submittedAt: "2026-09-15T08:00:00Z", createdAt: "2026-09-15T08:00:00Z" },
    { id: "new", submittedAt: "2026-09-15T09:00:00Z", createdAt: "2026-09-15T09:00:00Z" },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["new", "old"]);
});

test("Malta timestamp formatter is stable and non-editable display data", () => {
  assert.match(formatMaltaDateTime("2026-09-15T12:32:00Z"), /15 Sep 2026/);
});
```

- [ ] **Step 2: Run the helper test and prove RED**

Run:

```bash
node --experimental-strip-types --test tests/staff-dashboard-core.test.mjs
```

Expected: FAIL because `lib/staffDashboardCore.ts` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

Use `evaluateBarcodeAccess()` for active/expired/inactive classification so the Staff Dashboard cannot disagree with reception access logic. Use `Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Malta", ... })` for display only; never write localized strings back to the database.

```ts
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";

export type StaffMemberFilter = "all" | "active" | "expired";

export function classifyStaffMember(input: {
  status?: string | null;
  membershipExpiry?: string | null;
  today: string;
}) {
  const result = evaluateBarcodeAccess({ member: input, today: input.today }).result;
  if (result === "granted") return "active" as const;
  if (result === "expired") return "expired" as const;
  return "inactive" as const;
}
```

Implement the queue sort without mutating the caller's array and format with Malta timezone.

- [ ] **Step 4: Re-run the targeted test**

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

Expected: all pre-existing tests plus the new helper tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/staffDashboardCore.ts tests/staff-dashboard-core.test.mjs
git commit -m "test: add staff dashboard core rules"
```

---

### Task 2: Extend member search into a browse/search/filter API

**Files:**
- Modify: `app/api/system/members/search/route.ts`
- Create: `tests/staff-dashboard-api-contract.test.mjs`
- Reuse: `lib/staffDashboardCore.ts`

**Interfaces:**
- `GET /api/system/members/search?q=<text>&status=all|active|expired&page=<n>&limit=<n>`.
- Empty `q` is valid and returns a paginated member browser.
- Search fields: full name, member number, ID number, mobile, phone, email and legacy customer number.
- Candidate response adds `idNumber`, `classification`, `photoUrl`, `enrollmentGymId` while keeping existing fields used by renewal tooling.

- [ ] **Step 1: Add failing API-contract tests**

Test the route source for the required authorization and fields, without weakening the existing `members.view` permission.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("app/api/system/members/search/route.ts", "utf8");

test("member search remains system-auth protected", () => {
  assert.match(source, /requireSystemPermission\(request,\s*["']members\.view["']\)/);
});

test("staff member search includes ID number and status filter", () => {
  assert.match(source, /id_number/);
  assert.match(source, /searchParams\.get\(["']status["']\)/);
  assert.match(source, /searchParams\.get\(["']page["']\)/);
});
```

- [ ] **Step 2: Run the contract test and prove RED**

```bash
node --experimental-strip-types --test tests/staff-dashboard-api-contract.test.mjs
```

Expected: FAIL on missing status/page browse contract.

- [ ] **Step 3: Implement browse/search/filter behaviour**

Keep `requireSystemPermission(request, "members.view")`. Accept `q=""`; reject only malformed filters/page/limit. Clamp `limit` to 50. Sort browse results by `full_name` ascending for predictable reception use.

For blank `q`, query `bgm_members` directly with range pagination. For nonblank `q`, retain exact member-number fast path, then search all approved fields including `id_number`; deduplicate by member UUID.

Classify each returned member with `classifyStaffMember()` using a server-generated UTC date string (`YYYY-MM-DD`). Apply `status=active|expired` server-side before returning. Do not fold `inactive` into the `expired` label; inactive members remain visible under `all` with their own red/warning state.

Return a photo API URL only when the current system user has `members.photos.view` or is Super Admin.

- [ ] **Step 4: Re-run targeted and existing renewal/search tests**

```bash
node --experimental-strip-types --test tests/staff-dashboard-api-contract.test.mjs tests/member-*.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/system/members/search/route.ts tests/staff-dashboard-api-contract.test.mjs
git commit -m "feat: add staff member browsing and filters"
```

---

### Task 3: Add gym-scoped pending application list/detail/correction APIs

**Files:**
- Create: `app/api/system/members/applications/route.ts`
- Create: `app/api/system/members/applications/[applicationId]/route.ts`
- Modify: `tests/staff-dashboard-api-contract.test.mjs`
- Modify: `app/api/system/members/enroll/route.ts`

**Interfaces:**
- `GET /api/system/members/applications` returns pending applications for the authenticated gym, newest first.
- `GET /api/system/members/applications/:applicationId` returns full review data for one authorized pending application.
- `PATCH /api/system/members/applications/:applicationId` validates and persists corrected application/participant fields and records a before/after audit event.
- Normal staff scope comes only from `auth.context.gymId`; request bodies/query strings cannot choose another gym.
- Application states included in queue: `submitted`, `awaiting_payment`.

- [ ] **Step 1: Extend failing API contract tests for gym isolation**

```js
const queueSource = await readFile("app/api/system/members/applications/route.ts", "utf8").catch(() => "");
const detailSource = await readFile("app/api/system/members/applications/[applicationId]/route.ts", "utf8").catch(() => "");

test("pending applications are gym scoped server side", () => {
  assert.match(queueSource, /getSystemContext|requireSystemPermission/);
  assert.match(queueSource, /enrollment_gym_id/);
  assert.doesNotMatch(queueSource, /searchParams\.get\(["']gymId["']\)/);
});

test("application corrections create before and after audit data", () => {
  assert.match(detailSource, /bgm_audit_log/);
  assert.match(detailSource, /before_data/);
  assert.match(detailSource, /after_data/);
});
```

- [ ] **Step 2: Run targeted test and prove RED**

Expected: FAIL because the new routes do not exist.

- [ ] **Step 3: Implement the queue endpoint**

Require `members.create` for new applications and allow Super Admin. Because the fixed gym role also has `members.renew`, queue rows may contain either `new` or `renewal`; do not hide renewal rows.

Select only queue-summary fields from `bgm_membership_applications`, then fetch participant names/photo state and reserved card state in batched queries. For normal staff append `.eq("enrollment_gym_id", auth.context.gymId)`; Super Admin may see all gyms.

Return:

```ts
type StaffQueueApplication = {
  id: string;
  reference: string;
  kind: "new" | "renewal";
  status: "submitted" | "awaiting_payment";
  membershipType: string;
  enrollmentGymId: string;
  enrollmentGymName: string;
  submittedAt: string | null;
  createdAt: string;
  participants: Array<{
    id: string;
    fullName: string;
    hasPhoto: boolean;
    cardAssigned: boolean;
    reservedBarcode: string | null;
  }>;
};
```

- [ ] **Step 4: Implement the detail endpoint GET**

Fetch the application first, enforce gym ownership before returning participants, card state or photo URLs, then return editable fields:

```ts
type StaffApplicationReview = {
  id: string;
  reference: string;
  kind: "new" | "renewal";
  status: string;
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  enrollmentGymId: string;
  enrollmentGymName: string;
  submittedAt: string | null;
  paymentReceivedAt: string | null;
  activatedAt: string | null;
  participants: Array<{
    id: string;
    participantOrder: number;
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string;
    postcode: string;
    idNumber: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    nextOfKin: string;
    photoUrl: string | null;
    hasPhoto: boolean;
    reservedBarcode: string | null;
    currentBarcode: string | null;
  }>;
};
```

- [ ] **Step 5: Implement PATCH correction validation**

Only permit applications still in `submitted` or `awaiting_payment`. Reject any attempt to change `enrollment_gym_id`, `application_kind`, application ID, participant IDs or participant count. Validate membership type/duration/date shape using the same allowed sets as enrollment. Normalize email to lowercase and trim text fields.

The body shape is explicit:

```ts
{
  membershipType,
  durationKey,
  startDate,
  expiryDate,
  participants: [{
    id,
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    postcode,
    idNumber,
    dateOfBirth,
    phone,
    email,
    nextOfKin,
  }]
}
```

Fetch the full current application/participant state first and build `beforeData`. Validate the entire proposed payload before making writes. Update the application row and participant rows, then insert one `bgm_audit_log` row:

- `action_key = "membership.application.correct"`
- `entity_type = "membership_application"`
- `entity_id = applicationId`
- `system_user_id = auth.context.systemUserId`
- `context_gym_id = application.enrollment_gym_id`
- `before_data = beforeData`
- `after_data = normalizedAfterData`

If a write fails, return an error and leave the modal open. Do not claim success until the post-write refetch confirms the saved state.

- [ ] **Step 6: Expand submission audit to preserve the complete original form**

In `app/api/system/members/enroll/route.ts`, change the existing `membership.application.submit` audit `after_data` from metadata-only to a full sanitized snapshot containing membership fields and all participant form fields. Do not store password data, session secrets or card scanner raw metadata.

This snapshot is the immutable baseline for later clarifications even after staff corrections.

- [ ] **Step 7: Run targeted tests and full suite**

```bash
node --experimental-strip-types --test tests/staff-dashboard-api-contract.test.mjs
node --experimental-strip-types --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/system/members/applications app/api/system/members/enroll/route.ts tests/staff-dashboard-api-contract.test.mjs
git commit -m "feat: add gym scoped membership review APIs"
```

---

### Task 4: Add secure refresh-only Supabase Realtime signaling

**Files:**
- Create: `lib/staffRealtime.ts`
- Create: `lib/supabaseStaffBrowser.ts`
- Create: `app/api/system/staff/realtime/route.ts`
- Create: `components/staff/StaffRealtimeBridge.tsx`
- Modify: `app/api/system/members/enroll/route.ts`
- Modify: `app/api/system/members/card/assign/route.ts`
- Modify: `app/api/system/members/applications/[applicationId]/route.ts`
- Modify: `tests/staff-dashboard-api-contract.test.mjs`

**Interfaces:**
- Server topic derivation: `staffMembershipTopic(gymId: string): string` using HMAC-SHA256 with the BGM system session secret.
- Server signal: `broadcastStaffMembershipRefresh(gymId: string): Promise<void>`.
- Client event name: `membership-queue-changed`.
- Broadcast payload: `{ refresh: true }` only; no application ID, name, photo, email, phone, card number or form fields.
- `GET /api/system/staff/realtime` returns only the authenticated gym's opaque topic plus safe public Supabase URL/publishable key.

- [ ] **Step 1: Add failing security contracts**

```js
const realtimeSource = await readFile("lib/staffRealtime.ts", "utf8").catch(() => "");
const realtimeRoute = await readFile("app/api/system/staff/realtime/route.ts", "utf8").catch(() => "");

test("staff realtime topic is derived server-side and payload carries no member data", () => {
  assert.match(realtimeSource, /createHmac/);
  assert.match(realtimeSource, /membership-queue-changed/);
  assert.doesNotMatch(realtimeSource, /fullName|email|phone|idNumber|photoUrl/);
});

test("realtime config uses authenticated gym context", () => {
  assert.match(realtimeRoute, /getSystemContext|requireSystemPermission/);
  assert.match(realtimeRoute, /gymId/);
  assert.doesNotMatch(realtimeRoute, /searchParams\.get\(["']gym/);
});
```

- [ ] **Step 2: Run the contract test and prove RED**

Expected: FAIL because Realtime files do not exist.

- [ ] **Step 3: Implement server topic and broadcast helper**

Derive the opaque topic from the authenticated gym ID and the existing BGM system-session secret. Do not expose that secret or the service-role/secret Supabase key.

Use the existing server Supabase client and `channel.httpSend()` to send a public Broadcast on the opaque topic because `@supabase/supabase-js` is already >= 2.107. The event payload is always exactly `{ refresh: true }`.

Realtime is best-effort: if Broadcast fails, log it but do not roll back a successful database operation because queue recovery uses refetch/focus/reconnect.

- [ ] **Step 4: Add authenticated Realtime config endpoint**

Require a valid system session and `members.view`. For a normal gym account, return exactly one derived topic. Return safe public connection values from server environment:

```json
{
  "enabled": true,
  "topic": "bgm-staff-memberships:<opaque-token>",
  "supabaseUrl": "https://<project>.supabase.co",
  "publishableKey": "sb_publishable_..."
}
```

Never return `SUPABASE_SERVICE_ROLE_KEY` or any secret key.

For a Super Admin account with no gym ID, return `enabled: false` in this initial staff-dashboard slice; Super Admin still receives queue updates through focus/periodic refetch and the separate Management Portal remains the network-wide tool.

- [ ] **Step 5: Add browser Realtime bridge**

`StaffRealtimeBridge` fetches the config endpoint, creates a browser Supabase client, subscribes to the opaque public channel, and on `membership-queue-changed` invokes `onQueueChanged()` without trusting event data.

Also expose connection status to the dashboard:

```ts
type StaffRealtimeStatus = "connecting" | "connected" | "disconnected" | "disabled";
```

On `SUBSCRIBED`, set connected. On channel error/timeout/closed, set disconnected. Always clean up the channel on unmount.

- [ ] **Step 6: Broadcast only after successful persisted changes**

Call `broadcastStaffMembershipRefresh(enrollmentGymId)` after:

- successful application creation in `/api/system/members/enroll`
- successful pending-application correction PATCH
- successful card reserve/renewal card verification in `/api/system/members/card/assign`
- successful membership activation in `/api/system/members/enroll`

Do not broadcast before the database operation succeeds.

- [ ] **Step 7: Configure the safe Supabase publishable key for Preview/Production**

During execution, retrieve the project's current active publishable key through the connected Supabase tool and store it in Vercel as `SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` if the implementation chooses direct compile-time browser config). Do not paste the key into Git or chat output.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

- [ ] **Step 8: Run targeted/full tests**

```bash
node --experimental-strip-types --test tests/staff-dashboard-api-contract.test.mjs
node --experimental-strip-types --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/staffRealtime.ts lib/supabaseStaffBrowser.ts app/api/system/staff/realtime/route.ts components/staff/StaffRealtimeBridge.tsx app/api/system/members tests/staff-dashboard-api-contract.test.mjs
git commit -m "feat: add staff membership realtime refresh"
```

---

### Task 5: Build the always-open Staff Dashboard and member browser

**Files:**
- Create: `components/staff/StaffDashboard.tsx`
- Create: `components/staff/StaffMemberBrowser.tsx`
- Modify: `components/staff/StaffLoginPage.tsx`
- Create: `tests/staff-dashboard-ui-contract.test.mjs`

**Interfaces:**
- `StaffLoginPage` continues to own session check/login/logout.
- `StaffDashboard` receives the authenticated `SystemUser` and `onLogout` callback.
- `StaffMemberBrowser` fetches `/api/system/members/search` and opens a read-only detail panel.
- Dashboard exposes `refreshQueue(): Promise<void>` to the queue/realtime layer through component state rather than globals.

- [ ] **Step 1: Add failing UI contract tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile("components/staff/StaffDashboard.tsx", "utf8").catch(() => "");
const browser = await readFile("components/staff/StaffMemberBrowser.tsx", "utf8").catch(() => "");

test("staff dashboard is icon-first and exposes core reception actions", () => {
  for (const label of ["Members", "New Member", "Card / Reception", "Sundries", "Bar"]) {
    assert.match(dashboard, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(dashboard, /#ff5a0a/i);
});

test("member browser exposes All Active Expired filters", () => {
  assert.match(browser, />ALL</i);
  assert.match(browser, />ACTIVE</i);
  assert.match(browser, />EXPIRED</i);
});
```

- [ ] **Step 2: Run UI contract and prove RED**

Expected: FAIL because dashboard/browser files do not exist.

- [ ] **Step 3: Refactor `StaffLoginPage` without changing auth semantics**

Keep the existing calls exactly:

- `GET /api/system/auth` for session restore
- `POST /api/system/auth` with `{ username, password }`
- `DELETE /api/system/auth` for logout

When authenticated, render:

```tsx
<StaffDashboard user={user} onLogout={logout} />
```

Do not add a gym selector to normal staff login or dashboard.

- [ ] **Step 4: Implement desktop-first dashboard shell**

Header must contain:

- BGM identity
- `user.displayName` as the obvious gym/staff location label
- Malta current date/time
- Realtime connection indicator
- Waiting badge when count > 0
- Log Out

Use Lucide icons instead of emoji for operational controls. Keep labels short beneath/next to icons.

Operational tiles:

- Members -> focuses member browser
- New Member -> opens/focuses Waiting queue; badge displays pending count
- Card / Reception -> `/staff/reception`
- Sundries -> `/staff/sundries`
- Bar -> `/staff/bar`
- Punch Clock -> visible as future/disabled only if desired; no route/functionality in this task

- [ ] **Step 5: Implement member browser**

Default state loads `status=all&page=1&limit=50` so staff can view members without typing.

Search input is large and accepts name/member number/ID number/phone/email. Debounce text search by about 250–350 ms; cancel stale requests with `AbortController`.

Result rows/cards show photo, name, member number, expiry and a large classification badge:

- green `ACTIVE`
- red `EXPIRED`
- red/warning `INACTIVE`

Click opens read-only detail panel. No edit controls for established members in this phase.

- [ ] **Step 6: Run UI contract, typecheck and build**

```bash
node --experimental-strip-types --test tests/staff-dashboard-ui-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/staff/StaffLoginPage.tsx components/staff/StaffDashboard.tsx components/staff/StaffMemberBrowser.tsx tests/staff-dashboard-ui-contract.test.mjs
git commit -m "feat: build staff reception dashboard"
```

---

### Task 6: Add Waiting queue, arrival sound and review modal

**Files:**
- Create: `components/staff/StaffMembershipQueue.tsx`
- Create: `components/staff/StaffMembershipReviewModal.tsx`
- Modify: `components/staff/StaffDashboard.tsx`
- Modify: `tests/staff-dashboard-ui-contract.test.mjs`

**Interfaces:**
- Queue fetch: `GET /api/system/members/applications`.
- Detail fetch: `GET /api/system/members/applications/:id`.
- Correction save: `PATCH /api/system/members/applications/:id`.
- Card assignment: existing `POST /api/system/members/card/assign` with `{ applicationMemberId, barcode }`.
- Payment/activation: existing `POST /api/system/members/enroll` with `{ action: "activate", applicationId, activationStaffName }`.
- Review modal primary actions remain exactly: **SCAN CARD**, **PAYMENT RECEIVED**, **PRINT FORM**.

- [ ] **Step 1: Extend UI contract tests for queue/modal**

```js
const queue = await readFile("components/staff/StaffMembershipQueue.tsx", "utf8").catch(() => "");
const modal = await readFile("components/staff/StaffMembershipReviewModal.tsx", "utf8").catch(() => "");

test("new membership queue exposes waiting state", () => {
  assert.match(queue, /WAITING/);
  assert.match(queue, /submittedAt/);
});

test("review modal keeps the approved three primary actions", () => {
  assert.match(modal, /SCAN CARD/);
  assert.match(modal, /PAYMENT RECEIVED/);
  assert.match(modal, /PRINT FORM/);
  assert.doesNotMatch(modal, /ACTIVATE MEMBER/);
});
```

- [ ] **Step 2: Run UI test and prove RED**

Expected: FAIL because queue/modal files do not exist.

- [ ] **Step 3: Implement recoverable Waiting queue**

On dashboard mount, fetch pending applications from the database API. Refetch on:

- Realtime refresh callback
- window focus
- browser `online` event
- manual Retry button after an error
- a low-frequency safety interval (for example 30 seconds) while the page remains open

This interval is recovery only, not the primary realtime transport.

Sort newest first. If a new application ID appears and no review modal is active, play one short notification tone and automatically open the newest new item. If a modal is active, keep it unchanged and only increase the Waiting count.

Maintain a `seenApplicationIds` set initialized from the first successful queue load so existing pending rows do not all make noise after every refresh/restart.

- [ ] **Step 4: Make notification sound robust to browser autoplay rules**

Attempt to arm Web Audio after the login interaction/first pointer interaction. If the browser blocks audio after a restored session, show a compact bell control such as `Enable alerts`; clicking it arms audio. Visual popup/badge remains authoritative even if sound is unavailable.

- [ ] **Step 5: Implement editable review modal**

Layout:

- large member photo
- application reference
- automatic submitted date/time
- current state
- icon-led sections: Personal, Contact, Membership, Emergency Contact
- editable fields from the detail API

Do not permit gym/application-kind/participant-ID changes.

Track `dirty` locally. Before SCAN CARD, PAYMENT RECEIVED, PRINT FORM or modal close/minimize, call `saveCorrectionsIfDirty()`. If PATCH fails, block the primary action/close and show a clear error instead of silently discarding corrections.

- [ ] **Step 6: Implement SCAN CARD**

Clicking SCAN CARD reveals/focuses the barcode input. Support hardware scanner Enter submission.

Before POSTing the card, save dirty corrections. Then call the existing card-assignment endpoint. On success refetch detail and show green `CARD ASSIGNED ✓` with the reserved/verified barcode. On conflict, preserve the modal and show the server conflict message.

For Couples, require each participant to have their own card assignment/verification before payment is enabled; show participant-specific card controls.

- [ ] **Step 7: Implement PAYMENT RECEIVED = activation**

Disable until every participant has:

- official photo
- required card assignment/verification
- valid required fields

On click, open a minimal Staff Name prompt. On confirm:

1. save dirty corrections
2. POST the existing activation action
3. trust server response, not optimistic local state
4. refetch queue
5. show large green `MEMBERSHIP ACTIVE` confirmation with member photo/name/card number and Malta-formatted activation timestamp
6. after the confirmation delay, close and open the next waiting application if present

Prevent duplicate clicks while activation is in flight.

- [ ] **Step 8: Wire Realtime status and queue count into dashboard header/tile**

The header connection indicator reflects the bridge state. `New Member` displays the current pending count. Disconnected realtime must not hide the queue; safety refetch continues.

- [ ] **Step 9: Run targeted tests, typecheck and build**

```bash
node --experimental-strip-types --test tests/staff-dashboard-ui-contract.test.mjs tests/staff-dashboard-api-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add components/staff/StaffMembershipQueue.tsx components/staff/StaffMembershipReviewModal.tsx components/staff/StaffDashboard.tsx tests/staff-dashboard-ui-contract.test.mjs
git commit -m "feat: add staff membership processing queue"
```

---

### Task 7: Add A4 print form and print-request audit

**Files:**
- Create: `app/api/system/members/applications/[applicationId]/print/route.ts`
- Create: `components/staff/StaffApplicationPrint.tsx`
- Create: `app/staff/applications/[applicationId]/print/page.tsx`
- Modify: `components/staff/StaffMembershipReviewModal.tsx`
- Modify: `tests/staff-dashboard-api-contract.test.mjs`
- Modify: `tests/staff-dashboard-ui-contract.test.mjs`

**Interfaces:**
- `GET /api/system/members/applications/:applicationId/print` verifies gym scope, records `membership.application.print_requested`, and returns a printable snapshot.
- Print page URL: `/staff/applications/:applicationId/print`.
- Print action opens the dedicated route in a new tab/window from the user click.

- [ ] **Step 1: Add failing print contracts**

```js
const printRoute = await readFile("app/api/system/members/applications/[applicationId]/print/route.ts", "utf8").catch(() => "");
const printComponent = await readFile("components/staff/StaffApplicationPrint.tsx", "utf8").catch(() => "");

test("print snapshot is gym scoped and audited", () => {
  assert.match(printRoute, /bgm_audit_log/);
  assert.match(printRoute, /membership\.application\.print_requested/);
  assert.match(printRoute, /enrollment_gym_id/);
});

test("print form includes both member and staff signature areas", () => {
  assert.match(printComponent, /Member Signature/);
  assert.match(printComponent, /Staff Signature/);
  assert.match(printComponent, /@media print|print:/);
});
```

- [ ] **Step 2: Run and prove RED**

Expected: FAIL because print route/component do not exist.

- [ ] **Step 3: Implement print snapshot API**

Reuse the same application authorization rule as the review-detail API. Return final current values, not the original snapshot, because the printed filing form must reflect staff corrections.

Audit the print request with:

- system user ID
- gym ID
- application ID
- server timestamp from `bgm_audit_log.created_at`

The action key means **print requested/opened**, not proof that a physical printer completed the job.

- [ ] **Step 4: Implement A4 print component/page**

Include:

- BGM branding
- reference
- submitted timestamp
- photo
- corrected personal/contact fields
- membership type/duration/start/expiry
- selected gym
- assigned member/card number when available
- payment/activation date/time when activated
- payment staff name when available
- Member Signature + Date lines
- Staff Signature + Date lines
- processed-at gym line

Use CSS `@page { size: A4; margin: ... }` and print classes so app chrome/buttons disappear.

The page may attempt `window.print()` after data loads, but it must also show a visible Print button in case the browser blocks the automatic dialog.

- [ ] **Step 5: Wire PRINT FORM into review modal**

Before opening print, save dirty corrections. Use `window.open()` directly from the user click so browser popup blocking is minimized.

- [ ] **Step 6: Run targeted tests, typecheck and build**

```bash
node --experimental-strip-types --test tests/staff-dashboard-api-contract.test.mjs tests/staff-dashboard-ui-contract.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/system/members/applications/[applicationId]/print app/staff/applications/[applicationId]/print components/staff/StaffApplicationPrint.tsx components/staff/StaffMembershipReviewModal.tsx tests/staff-dashboard-api-contract.test.mjs tests/staff-dashboard-ui-contract.test.mjs
git commit -m "feat: add printable membership filing form"
```

---

### Task 8: Add Playwright workflow verification and CI coverage

**Files:**
- Create: `tests/browser/staff-dashboard.mjs`
- Modify: `.github/workflows/phase2-ci.yml`

**Interfaces:**
- Browser test uses mocked staff APIs; it must not need production credentials.
- Artifact directory: `test-artifacts/staff-ui`.

- [ ] **Step 1: Write the failing browser verification script**

Start the production Next build on a separate local test port. Mock:

- `/api/system/auth` authenticated Birkirkara system user
- `/api/system/members/search`
- `/api/system/members/applications`
- `/api/system/members/applications/<id>` GET/PATCH
- `/api/system/members/card/assign`
- `/api/system/members/enroll`
- `/api/system/staff/realtime` with `enabled: false` for deterministic browser CI

Verify at desktop width (~1440):

1. header identifies Birkirkara staff session
2. icon tiles are visible without a hamburger menu
3. ALL/ACTIVE/EXPIRED member filters work
4. search by ID-card text produces the expected mocked member
5. pending count shows `1 WAITING`
6. opening pending member shows photo and editable fields
7. SCAN CARD sends the correct participant/card payload and turns green
8. PAYMENT RECEIVED asks for staff name and sends `action: "activate"`
9. success state shows `MEMBERSHIP ACTIVE`
10. queue becomes empty after activation

Also verify a tablet width (~820) has no horizontal overflow and primary controls remain usable.

Save screenshots for dashboard, application review, and activation success.

- [ ] **Step 2: Run against the built app and prove/fix failures**

```bash
npm run build
node tests/browser/staff-dashboard.mjs
```

Expected: PASS with screenshots in `test-artifacts/staff-ui`.

- [ ] **Step 3: Add Staff Dashboard browser verification to CI**

After the existing member-card/gyms browser step, add:

```yaml
- name: Verify staff dashboard in Chromium
  run: node tests/browser/staff-dashboard.mjs
```

Expand screenshot artifact upload to include:

```yaml
path: |
  test-artifacts/member-ui
  test-artifacts/staff-ui
```

- [ ] **Step 4: Run the exact CI commands locally**

```bash
npm ci
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
node tests/browser/member-card-gyms.mjs
node tests/browser/staff-dashboard.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/staff-dashboard.mjs .github/workflows/phase2-ci.yml
git commit -m "test: verify staff dashboard workflow"
```

---

### Task 9: Controlled Preview verification with live Supabase Realtime

**Files:**
- No product files unless verification exposes a real defect.
- Vercel project configuration: safe Supabase publishable key for Preview/Production.

**Interfaces:**
- Preview must run the exact feature-branch SHA.
- Live Realtime verification uses two authenticated test sessions for one gym only; do not use real member PII when synthetic test data is sufficient.

- [ ] **Step 1: Run fresh pre-push verification**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 2: Push feature branch and open a draft PR**

PR description must summarize:

- staff dashboard redesign
- member browse/search filters
- gym-specific pending queue
- refresh-only Realtime design
- card/payment/print workflow
- audit changes
- no member-side business-logic changes

- [ ] **Step 3: Verify CI on the exact PR head SHA**

Do not move to user testing until Phase 2 CI completes successfully for that exact head.

- [ ] **Step 4: Verify Vercel Preview exact SHA and environment**

Confirm:

- deployment is READY
- deployment Git SHA equals PR head
- `SUPABASE_PUBLISHABLE_KEY` is present for Preview without revealing its value
- existing server Supabase variables remain present

- [ ] **Step 5: Verify live gym isolation and Realtime behaviour**

Use controlled test applications:

1. log into Staff Dashboard as a single gym test/shared account
2. create/submit a synthetic pending application for that same gym through the existing enrollment path/API
3. confirm the staff dashboard receives one sound/visual arrival and refetches the application
4. confirm another gym session does not display that application
5. refresh the first gym dashboard and confirm the pending application is rebuilt from Postgres
6. reserve a synthetic unused test card
7. enter a test staff name and activate
8. confirm waiting count drops and permanent member/card state is correct
9. open print view and confirm corrected values + signatures layout

Clean up only synthetic test data that is safe to remove; never delete live member records as part of verification.

- [ ] **Step 6: Check Supabase/Vercel errors after the controlled workflow**

- inspect Vercel runtime error/fatal logs for the exact Preview deployment
- run Supabase security/performance advisors if any database/security configuration changed
- confirm no service-role/secret key reached browser HTML/JS/network responses

- [ ] **Step 7: Present Preview to the user for visual/operational approval**

Do not merge based only on CI. User validates that the staff screen is simple enough for reception use and the queue/modal/card/payment/print sequence matches the approved flow.

---

### Task 10: Merge and production verification after explicit approval

**Files:**
- No further changes unless approval feedback requires them.

- [ ] **Step 1: Re-run verification on the final approved PR head**

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 2: Confirm PR state and exact head SHA**

Verify the PR is mergeable and all required CI checks are successful for the same head SHA the user approved.

- [ ] **Step 3: Merge only after explicit user authorization**

Use the established repository PR workflow. Do not push directly to `main`.

- [ ] **Step 4: Verify production deployment exact SHA**

Confirm production Vercel deployment:

- target `production`
- state/readyState `READY`
- no alias error
- Git SHA equals merged `main`
- production domain still resolves

- [ ] **Step 5: Production smoke checks**

Verify without exposing credentials:

- `/staff` loads/login surface
- authenticated staff dashboard loads for a controlled gym session
- member search endpoint is auth-protected
- pending application endpoint is auth-protected and gym-scoped
- `/staff/reception` existing barcode reception still works
- member app smoke routes remain healthy

- [ ] **Step 6: Check post-merge CI and runtime logs**

Require successful main CI on the merged SHA and no new production error/fatal logs attributable to the release.

- [ ] **Step 7: Record final handover baseline**

Capture:

- merged main SHA
- production deployment ID
- main CI run ID/result
- final Staff Dashboard routes/APIs
- any remaining future work, especially the public/tablet New Member form and Punch Clock
