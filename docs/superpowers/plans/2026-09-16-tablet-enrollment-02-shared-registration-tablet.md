# Shared Registration & Tablet PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable membership-registration domain/form and the online-only gym-specific `/join/<gym-slug>` PWA submission flow with live photos, server-authoritative snapshots and duplicate classification.

**Architecture:** Extend the existing application tables rather than creating a parallel enrollment system. Public routes receive only a minimal published configuration; a public submission endpoint revalidates gym, price, declarations, identity state and photos, then inserts the pending application atomically through a service-role RPC. The UI form is shared-domain code so Plan 03 can reuse it inside authenticated Staff New Membership.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Supabase/PostgreSQL/Storage, browser MediaDevices/Canvas, Web App Manifest, Node test runner, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md`

## Global Constraints

- Depends on Plan 01 and its published-price/declaration interfaces.
- Tablet is New Member only; no customer-visible Renewal action.
- Gym comes from the URL and is revalidated server-side; no public gym selector.
- Tablet submission is online-only; no IndexedDB application persistence in this plan.
- Live camera photo is required for every tablet applicant; no gallery/file picker.
- Couples submit two full participants and two live photos.
- Public responses never expose existing member names, member numbers, contact data or history.
- Active exact ID/passport match blocks public submission. Expired/inactive match is accepted and flagged for staff.
- Exact mobile/email matches are warning metadata for reception only, not a public blocker.
- Application start date is the server `Europe/Malta` date; expiry derives from canonical duration rules.
- Price and declaration version snapshots come from the server, never trusted from client input.
- Existing `bgm-member-photos` private bucket remains the photo store.
- No Vercel Preview is created during this plan.

---

### Task 1: Extend pending-application schema for public/tablet snapshots

**Files:**
- Create: `supabase/migrations/20260916_130000_public_membership_enrollment.sql`
- Create: `tests/public-membership-enrollment-schema.test.mjs`

**Interfaces:**
- Extends `bgm_gyms` with `public_enrollment_slug`.
- Extends `bgm_membership_applications` with source/price/declaration snapshot fields.
- Extends `bgm_membership_application_members` with guardian and duplicate-classification fields.
- Adds `bgm_public_enrollment_rate_buckets`.
- Produces RPC `bgm_create_public_membership_application(jsonb)`.

- [ ] **Step 1: Write RED schema contract**

Require at least these columns/constraints:

```js
assert.match(sql, /public_enrollment_slug text/i);
assert.match(sql, /application_source/i);
assert.match(sql, /base_price_cents/i);
assert.match(sql, /price_catalog_version_id/i);
assert.match(sql, /gym_rules_version_id/i);
assert.match(sql, /privacy_version_id/i);
assert.match(sql, /health_version_id/i);
assert.match(sql, /identity_match_state/i);
assert.match(sql, /matched_member_id/i);
assert.match(sql, /guardian_name/i);
assert.match(sql, /bgm_create_public_membership_application/i);
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/public-membership-enrollment-schema.test.mjs
```

- [ ] **Step 3: Implement schema**

Add to `bgm_gyms`:

```sql
alter table public.bgm_gyms
  add column if not exists public_enrollment_slug text;
create unique index if not exists bgm_gyms_public_enrollment_slug_uidx
  on public.bgm_gyms(public_enrollment_slug)
  where public_enrollment_slug is not null;
```

Seed known IDs deterministically (`bgm-birkirkara -> birkirkara`, `bgm-talqroqq -> talqroqq`; other `bgm-*` IDs use the suffix unless an explicit exceptional mapping is required). Do not generate slugs from mutable display names.

Application additions:

```sql
alter table public.bgm_membership_applications
  add column application_source text not null default 'staff'
    check (application_source in ('staff','tablet','offline_staff')),
  add column submitted_on_malta date,
  add column base_price_cents integer check (base_price_cents is null or base_price_cents >= 0),
  add column currency text default 'EUR' check (currency is null or currency = 'EUR'),
  add column price_catalog_version_id uuid references public.bgm_membership_price_catalog_versions(id),
  add column gym_rules_version_id uuid references public.bgm_membership_declaration_versions(id),
  add column privacy_version_id uuid references public.bgm_membership_declaration_versions(id),
  add column health_version_id uuid references public.bgm_membership_declaration_versions(id),
  add column declaration_snapshot jsonb,
  add column document_readiness_ack_at timestamptz;
```

Participant additions must include `town`, guardian fields, `under_18_at_submission boolean not null default false`, `identity_match_state` constrained to `clear|active|expired_inactive`, `matched_member_id uuid references bgm_members(id)`, plus `duplicate_contact_warning boolean not null default false`.

`bgm_create_public_membership_application(jsonb)` accepts server-built JSON only through service role, locks/validates no active identity state, inserts application + one/two participant rows with explicit server-generated UUIDs, and writes an audit event. It must not allocate a permanent member number or card.

- [ ] **Step 4: Apply migration to development Supabase and inspect**

Read the Supabase plugin skill before mutation. Confirm the RPC is not executable by `anon` or `authenticated`; service role only.

- [ ] **Step 5: GREEN and commit**

```bash
node --test tests/public-membership-enrollment-schema.test.mjs
git add supabase/migrations/20260916_130000_public_membership_enrollment.sql tests/public-membership-enrollment-schema.test.mjs
git commit -m "feat: extend membership applications for tablet enrollment"
```

---

### Task 2: Build the shared registration-domain core

**Files:**
- Create: `lib/membershipRegistrationCore.ts`
- Create: `tests/membership-registration-core.test.mjs`
- Modify: `lib/membershipEnrollmentCore.ts` only to reuse existing canonical duration/date logic rather than duplicate it.

**Interfaces:**

```ts
export type RegistrationMode = "tablet" | "staff";
export type IdentityMatchState = "clear" | "active" | "expired_inactive";
export type RegistrationParticipant = {
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  nextOfKin: string;
  guardian?: GuardianDetails;
};
export function normalizeIdentityDocument(value: string): string;
export function isUnder18On(dateOfBirth: string, submissionDate: string): boolean;
export function requiredDocumentMessage(type: MembershipType): string[];
export function participantCountForType(type: MembershipType): 1 | 2;
```

- [ ] **Step 1: Write RED tests**

Cover ID normalization, exact age boundary using calendar dates, Couples count=2, document messages and validation that guardian fields are required when under 18.

Example:

```js
test("minor status is locked to submission date", () => {
  assert.equal(isUnder18On("2008-09-17", "2026-09-16"), true);
  assert.equal(isUnder18On("2008-09-16", "2026-09-16"), false);
});
```

- [ ] **Step 2: RED**

```bash
node --experimental-strip-types --test tests/membership-registration-core.test.mjs
```

- [ ] **Step 3: Implement pure functions and reuse canonical duration expiry calculation**

Do not calculate expiry separately in the UI. Export/consume the existing canonical function from `membershipEnrollmentCore.ts` if necessary.

- [ ] **Step 4: GREEN and commit**

```bash
node --experimental-strip-types --test tests/membership-registration-core.test.mjs tests/membership-enrollment-core.test.mjs
git add lib/membershipRegistrationCore.ts lib/membershipEnrollmentCore.ts tests/membership-registration-core.test.mjs
git commit -m "feat: add shared membership registration domain"
```

---

### Task 3: Add minimal public enrollment configuration and identity-check APIs

**Files:**
- Create: `app/api/public/membership-enrollment/config/route.ts`
- Create: `app/api/public/membership-enrollment/identity-check/route.ts`
- Create: `lib/publicEnrollmentSecurity.ts`
- Create: `tests/public-enrollment-api-contract.test.mjs`

**Interfaces:**
- `GET /api/public/membership-enrollment/config?gymSlug=birkirkara`
- `POST /api/public/membership-enrollment/identity-check` body `{ gymSlug, idNumber }`
- Produces `hashPublicRateKey(ip, gymSlug, secret)` and `resolveClientIp(request)`.

Config response shape:

```ts
{
  gym: { id: string; name: string; shortName: string; slug: string };
  pricing: { versionId: string; entries: Array<{ membershipType: MembershipType; durationKey: MembershipDurationKey; amountCents: number; currency: "EUR" }> };
  declarations: { gymRules: PublishedDeclaration; privacy: PublishedDeclaration; health: PublishedDeclaration; guardian?: PublishedDeclaration };
}
```

Identity response is deliberately non-PII:

```ts
{ state: "clear" | "active" | "expired_inactive" }
```

- [ ] **Step 1: Write RED API contracts**

Require active-gym slug validation, published settings only, `Europe/Malta` readiness, normalized identity lookup and no member detail fields in response.

- [ ] **Step 2: Implement `publicEnrollmentSecurity.ts`**

Resolve proxy IP from trusted Vercel/forwarded request headers; never persist raw IP. Hash `secret + "|" + gymSlug + "|" + ip` with SHA-256. `BGM_PUBLIC_ENROLLMENT_RATE_SALT` is generated during environment setup; never ask the user to paste an existing secret into chat.

- [ ] **Step 3: Implement config route**

Return 404 for unknown/inactive slug. Return 503 `{ error: "Enrollment is not ready." }` if price catalog or required declarations are not published. Return only currently published versions.

- [ ] **Step 4: Implement identity-check route**

Normalize ID, query only fields needed to classify status/expiry, and return `active` when status is active and expiry has not passed; otherwise exact matching historical member becomes `expired_inactive`. Do not return matched member ID publicly.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/public-enrollment-api-contract.test.mjs tests/membership-registration-core.test.mjs
git add app/api/public/membership-enrollment/config/route.ts app/api/public/membership-enrollment/identity-check/route.ts lib/publicEnrollmentSecurity.ts tests/public-enrollment-api-contract.test.mjs
git commit -m "feat: add public enrollment config and identity checks"
```

---

### Task 4: Add rate-limited atomic public submission with private live photos

**Files:**
- Create: `app/api/public/membership-enrollment/submit/route.ts`
- Create: `tests/public-enrollment-submit-contract.test.mjs`
- Modify: `supabase/migrations/20260916_130000_public_membership_enrollment.sql` only if test-first work reveals the rate bucket/RPC contract needs a correction; otherwise add a follow-up migration `20260916_131000_public_enrollment_rate_limit.sql`.

**Interfaces:**
- `POST /api/public/membership-enrollment/submit` multipart fields:
  - `payload`: JSON string
  - `photo0`: WebP File
  - `photo1`: WebP File only for Couples
- Success response: `{ ok: true, applicationId: string }`.

- [ ] **Step 1: Write RED submission contract**

Assert route enforces `image/webp`, max 5 MiB each, exact required photo count, server settings lookup, identity recheck, rate bucket, server-generated UUIDs, storage path prefix `applications/`, RPC creation and storage cleanup on DB failure.

- [ ] **Step 2: Implement request parsing and hard limits**

Do not trust client `price`, `startDate`, `expiryDate`, declaration IDs, matched member IDs or under-18 flags. Accept only membership type/duration, participant form values, acknowledgement booleans and photos.

- [ ] **Step 3: Implement server-authoritative snapshot assembly**

Resolve `submittedOnMalta`, published price row, canonical expiry, current declaration IDs/bodies/SHA hashes, normalized identity states and contact warnings. If any participant is an active match, return 409 and create nothing.

- [ ] **Step 4: Implement rate bucket**

Use the hashed fingerprint and a database row/RPC to cap completed submission attempts, e.g. 10 submissions per fingerprint/gym per rolling hour. Return 429 without disclosing internal counts. The database operation must be race-safe.

- [ ] **Step 5: Upload live photos then atomically create DB rows**

Generate `applicationId` and participant UUIDs with `randomUUID()`. Upload to existing private bucket `bgm-member-photos`:

```ts
const path = `applications/${applicationId}/${participantId}/${randomUUID()}.webp`;
```

After uploads succeed, call `bgm_create_public_membership_application(payload)`. If RPC fails, remove every uploaded object before returning an error. Insert photo provenance rows as part of DB creation or immediately after with cleanup/rollback semantics documented and tested.

- [ ] **Step 6: GREEN and commit**

```bash
node --experimental-strip-types --test tests/public-enrollment-submit-contract.test.mjs tests/public-enrollment-api-contract.test.mjs
git add app/api/public/membership-enrollment/submit/route.ts tests/public-enrollment-submit-contract.test.mjs supabase/migrations/20260916_13*.sql
git commit -m "feat: add secure tablet enrollment submission"
```

---

### Task 5: Build reusable registration form UI

**Files:**
- Create: `components/membership/RegistrationForm.tsx`
- Create: `components/membership/LivePhotoCapture.tsx`
- Create: `components/membership/RegistrationDeclarations.tsx`
- Create: `components/membership/RegistrationDocumentWarning.tsx`
- Create: `tests/registration-form-ui-contract.test.mjs`

**Interfaces:**

```ts
export type RegistrationFormProps = {
  mode: "tablet" | "staff";
  gym: { id: string; name: string; slug?: string };
  config: PublicEnrollmentConfig;
  initialParticipants?: RegistrationParticipant[];
  onSubmit: (draft: RegistrationDraft) => Promise<void>;
  staffPhotoPolicy?: "required" | "optional";
};
```

- [ ] **Step 1: Write RED UI contract**

Require membership selector, duration/price display, immediate document warning, participant fields, under-18 guardian section, Couples second participant, declaration acknowledgements and mode-specific photo policy.

- [ ] **Step 2: Implement form state as in-memory React state only**

Do not put applicant PII in `localStorage` or URL query parameters. Tablet reset must replace state with blank values after a confirmed server success.

- [ ] **Step 3: Implement live camera capture**

`LivePhotoCapture` uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })`, renders a preview, captures to canvas and exports WebP. Tablet mode exposes `Take Photo`, `Retake`, `Use Photo`; no `<input type=file>`.

- [ ] **Step 4: Implement identity early-check**

After a syntactically complete ID/passport field loses focus, call identity-check. `active` shows a blocking reception message; `expired_inactive` allows continuation and may show neutral wording that reception will review an existing membership. Submission still rechecks server-side.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/registration-form-ui-contract.test.mjs tests/membership-registration-core.test.mjs
git add components/membership tests/registration-form-ui-contract.test.mjs
git commit -m "feat: add shared membership registration form"
```

---

### Task 6: Add gym-specific PWA route and network-only service worker

**Files:**
- Create: `app/join/[gymSlug]/page.tsx`
- Create: `app/join/[gymSlug]/manifest.webmanifest/route.ts`
- Create: `components/membership/JoinEnrollmentPage.tsx`
- Create: `components/membership/JoinPwaRegistration.tsx`
- Create: `public/join-sw.js`
- Create: `tests/tablet-enrollment-pwa-contract.test.mjs`

**Interfaces:**
- `/join/<gymSlug>` loads config and renders `RegistrationForm mode="tablet"`.
- `/join/<gymSlug>/manifest.webmanifest` returns a manifest whose `start_url` is that exact gym route.
- `/join-sw.js` performs network pass-through only; it never caches application requests or PII.

- [ ] **Step 1: Write RED PWA contract**

Require dynamic manifest `start_url`, `display: "standalone"`, BGM icons, route-based gym label and service worker source with no `caches.open`/Cache API use.

- [ ] **Step 2: Implement dynamic manifest**

Return JSON like:

```ts
{
  name: `BestGymsMalta ${gym.shortName} Registration`,
  short_name: "BGM Registration",
  start_url: `/join/${gymSlug}`,
  scope: "/join/",
  display: "standalone",
  background_color: "#f6f6f6",
  theme_color: "#ff5a0a",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
  ]
}
```

Use the actual existing icon filenames after inspecting `public/icons`; do not invent missing paths.

- [ ] **Step 3: Implement route/page**

Use `generateMetadata` so each gym page links its dynamic manifest. Unknown/inactive slugs render a clean not-found/unavailable state. Submit through the multipart endpoint and show the type-specific success instructions, then a clear **Finish / Reset for next member** action.

- [ ] **Step 4: Register network-only service worker**

`join-sw.js` should contain install/activate handlers only (or a fetch handler that simply `return fetch(event.request)`), with no offline queue and no Cache API storage of forms/responses.

- [ ] **Step 5: GREEN and commit**

```bash
node --experimental-strip-types --test tests/tablet-enrollment-pwa-contract.test.mjs tests/registration-form-ui-contract.test.mjs
git add app/join components/membership/JoinEnrollmentPage.tsx components/membership/JoinPwaRegistration.tsx public/join-sw.js tests/tablet-enrollment-pwa-contract.test.mjs
git commit -m "feat: add gym-specific enrollment pwa"
```

---

### Task 7: Add Chromium tablet-flow verification

**Files:**
- Create: `tests/browser/tablet-enrollment.mjs`
- Modify: `.github/workflows/phase2-ci.yml`

**Interfaces:**
- Produces screenshots under `test-artifacts/tablet-enrollment/`.

- [ ] **Step 1: Write browser test with mocked API responses**

Launch the built app locally, intercept public config/identity/submit APIs, navigate to `/join/birkirkara`, select Student, assert the document warning appears before personal details, complete the form, simulate photo capture through a test hook or injected MediaDevices stub, accept declarations and submit. Assert success screen mentions reception/student document.

- [ ] **Step 2: Add Couples and active-member cases**

Verify Couples renders two participant/photo sections and active ID response blocks progress with a reception message.

- [ ] **Step 3: Add CI step**

After existing staff Chromium verification:

```yaml
- name: Verify tablet enrollment workflow in Chromium
  run: node tests/browser/tablet-enrollment.mjs
```

Upload `test-artifacts/tablet-enrollment` on `always()`.

- [ ] **Step 4: Run locally and commit**

```bash
npm run build
node tests/browser/tablet-enrollment.mjs
git add tests/browser/tablet-enrollment.mjs .github/workflows/phase2-ci.yml
git commit -m "test: cover tablet enrollment workflow"
```

---

### Task 8: Plan-02 verification gate

- [ ] **Step 1: Targeted tests**

```bash
node --experimental-strip-types --test \
  tests/public-membership-enrollment-schema.test.mjs \
  tests/membership-registration-core.test.mjs \
  tests/public-enrollment-api-contract.test.mjs \
  tests/public-enrollment-submit-contract.test.mjs \
  tests/registration-form-ui-contract.test.mjs \
  tests/tablet-enrollment-pwa-contract.test.mjs
```

- [ ] **Step 2: Typecheck/build/browser**

```bash
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/tablet-enrollment.mjs
```

- [ ] **Step 3: Local HTTPS tablet check without Vercel**

Run `npm run dev`, then expose the local port with a temporary Cloudflare Quick Tunnel. On a real tablet, test `/join/birkirkara`: install/add PWA, camera permission, capture/retake, submit/reset, rotate portrait/landscape. Stop the tunnel immediately after testing.

- [ ] **Step 4: Confirm Vercel deployment list is unchanged**

Do not proceed to Plan 03 until all checks pass.