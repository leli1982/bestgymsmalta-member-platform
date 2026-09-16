# Tablet Enrollment Plan — Self-Review Amendments

Date: 2026-09-16
Status: Required amendments to Plans 01–04

This document is part of the implementation plan. Where it changes a task in Plans 01–04, this amendment wins. These corrections were found by checking every approved spec section against the implementation plan after the visual prototype was approved.

## Amendment A — Couples declaration acceptance is participant-specific

**Applies to:** Plan 02 Tasks 1, 4 and 5; Plan 03 printing/audit.

The application may share declaration **versions**, but acceptance must be recorded per participant. Extend `bgm_membership_application_members` with:

```sql
gym_rules_accepted_at timestamptz,
privacy_accepted_at timestamptz,
health_accepted_at timestamptz
```

For an under-18 participant, guardian acknowledgement/co-sign remains separate and is not a substitute for the member/application declaration record.

`RegistrationDeclarations.tsx` must render acceptance controls per participant for Couples, clearly labelled `Applicant 1` and `Applicant 2`. Single/Student render one set.

The public submission RPC receives only server-generated acceptance timestamps after the corresponding booleans were true. It never accepts caller-supplied timestamps.

Add to `tests/registration-form-ui-contract.test.mjs` and `tests/public-membership-enrollment-schema.test.mjs`:

```js
assert.match(component, /Applicant 1/);
assert.match(component, /Applicant 2/);
assert.match(sql, /gym_rules_accepted_at/i);
assert.match(sql, /privacy_accepted_at/i);
assert.match(sql, /health_accepted_at/i);
```

The A4 member sheet uses that participant's acceptance record and the shared immutable declaration snapshot/version.

## Amendment B — Camera denial/failure must be recoverable without losing the form

**Applies to:** Plan 02 Task 5 and browser tests.

`LivePhotoCapture.tsx` must distinguish:

```ts
type CameraState = "idle" | "requesting" | "ready" | "captured" | "denied" | "unavailable" | "error";
```

If `getUserMedia` rejects with `NotAllowedError`, show:

**Camera access is required for tablet registration. Please allow camera access and try again.**

Provide **Try Camera Again**. If no camera/device API exists, show a reception-directed message. Do not expose a gallery fallback in tablet mode.

A failed network submission must leave every form field and captured in-memory photo intact. Only a confirmed `{ ok: true, applicationId }` response enables the final success/reset flow.

Add browser cases for denied camera -> retry -> capture and failed submit -> retry without retyping.

## Amendment C — Audit every approved business event

**Applies to:** Plans 01–04.

The following must create `bgm_system_audit_log` rows when server-side, or retain local occurrence metadata until sync when offline:

- price draft/save and price publication;
- discount create/edit/active-state change;
- declaration draft/save and publication;
- tablet submission + enrollment gym context + price/declaration version ids;
- duplicate identity classification and possible-renewal match;
- participant converted to existing member;
- rejection reason;
- staff corrections and every verification confirmation;
- card reserve/replace/finalize;
- discount preview selected on application and successful consumption;
- payment method/Staff Name/Payment Received;
- activation;
- photo capture/upload/replace and the event that clears PHOTO REQUIRED;
- print and reprint;
- offline queue occurrence time, sync success, conflict or failure.

Plan 01 API write actions therefore must call the existing audit helper/table for draft/change events in addition to publication RPC auditing. Plan 03 print endpoint must log print/reprint server-side before returning print data. Photo upload to an existing member must also create/retain the appropriate audit event in addition to photo provenance.

Add source-contract assertions for the relevant audit insert/helper calls rather than relying on manual verification.

## Amendment D — Offline renewal is required

**Applies to:** Plan 04 Tasks 2, 4, 5, 6 and 7.

Offline Staff enrollment has two actions:

- **NEW MEMBERSHIP**
- **RENEWAL**

Offline renewal does **not** cache/search the full member database. Staff identifies the member with a known permanent identifier normally obtained by scanning the current physical card or entering the permanent BGM membership number.

Extend `OfflineMembershipRecord`:

```ts
export type OfflineMembershipKind = "new" | "renewal";

export type OfflineMembershipRecord = {
  clientSubmissionId: string;
  kind: OfflineMembershipKind;
  renewalIdentifier?: string;
  // existing fields from Plan 04 remain
};
```

Offline renewal UI requires `renewalIdentifier` before continuing and states:

**Member identity will be confirmed with the central system when internet returns.**

On sync the server resolves the identifier against current card credentials/permanent member number. Outcomes:

```ts
"resolved_renewal"       -> continue using existing member and permanent number
"renewal_not_found"      -> review_required; never create a new member
"renewal_ambiguous"      -> review_required; never create a new member
"renewal_active_conflict"-> review_required; no automatic changes
```

A replacement card entered offline remains `CARD PENDING CONFIRMATION`; Keep Existing Card is stored as the intended action but still revalidated centrally.

Add tests proving an unresolved offline renewal can never fall through to new-member creation.

## Amendment E — Offline discount code may be queued, but never finalized offline

**Applies to:** Plan 04 Tasks 2, 4 and 5.

Replace the instruction that disables discount entry entirely. Offline Staff may optionally enter a discount code as **PENDING VALIDATION**.

Extend the queue record:

```ts
requestedDiscountCode?: string;
```

While offline:

- do not display a confirmed percentage/discounted final total from the code;
- do not consume a use;
- show `DISCOUNT PENDING ONLINE VALIDATION`;
- if payment amount depends on the discount, the operational receipt remains `PENDING ONLINE ACTIVATION`.

During sync, validate the code using the same server rules as Plan 03. If valid, calculate/consume it only inside successful activation. If invalid/expired/exhausted, persist the application as `review_required` with `discount_conflict`; never silently remove the code or change the amount.

Update `decideOfflineSyncOutcome` with:

```ts
requestedDiscountInvalid -> review_required("discount_conflict")
```

## Amendment F — Offline device initialization and restart behavior must be explicit

**Applies to:** Plan 04 Tasks 3–4 and browser tests.

Offline membership entry is enabled only when all are true:

```ts
hasCachedAuthenticatedGymContext === true
hasCachedPublishedEnrollmentConfig === true
cachedGymId === selectedStaffGymId
```

An uninitialized browser shows **Offline enrollment is not ready on this device. Reconnect to initialize it.** and cannot save offline membership data.

The queue must survive browser/PWA restart. Browser verification must:

1. initialize online;
2. go offline;
3. queue an application;
4. close/reopen the page/PWA shell;
5. confirm queued count and record still exist;
6. reconnect and sync.

No password, session secret or full member roster is stored in IndexedDB.

## Amendment G — Contact warnings and identity rules must be participant-specific

**Applies to:** Plan 02 Task 4, Plan 03 Task 3.

During public submission, perform normalized exact mobile/email comparisons for each participant. They never block submission. Persist enough warning metadata for staff review without exposing the matching member publicly.

For Couples:

- any participant with an ACTIVE exact ID/passport match blocks the whole public submission;
- expired/inactive matches are stored per participant;
- reception may reuse an expired/inactive matched participant independently while another participant is genuinely new;
- activation remains one atomic Couples transaction.

This is the concrete implementation of the spec's participant/member distinction and prevents duplicate people in mixed returning/new Couples applications.

## Amendment H — Malta date helper is shared by public, discount and barcode paths

**Applies to:** Plans 02–03.

Create one pure helper in an existing date utility or new `lib/maltaDate.ts`:

```ts
export function maltaCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```

If runtime formatting produces locale separators unexpectedly, construct the YYYY-MM-DD string from `formatToParts`; tests must pin summer and winter UTC-boundary cases. Use this helper for submission date, membership access `today`, and discount validity windows. Do not use `new Date().toISOString().slice(0, 10)` for Malta business dates.

## Amendment I — Print publication overflow gate must be enforced, not informational

**Applies to:** Plan 03 Task 5.

When Super Admin edits Gym Rules/privacy/health/guardian wording, the real `MembershipA4Sheet` measurement fixture must be used. **Publish** remains disabled while any required representative sheet overflows. Representative fixtures are:

- Regular adult;
- Student adult;
- Regular under-18 with guardian block;
- one participant of Couples with shared payment/discount fields.

Do not solve overflow by dynamically shrinking text below the component's fixed readable minimum. The admin must edit wording/layout before publication.

## Amendment J — Success screens and queue recovery remain type-specific

**Applies to:** Plan 02 Task 6 and Plan 03 queue tests.

After confirmed tablet submission:

- Regular: remind ID/passport at reception;
- Student: remind ID/passport + student eligibility document;
- Couples: remind both IDs + same-address evidence;
- any under-18 participant: remind guardian must be present to co-sign.

After showing the success state, **Finish / Reset for next member** clears all PII and captured photos from React memory.

If realtime notification is missed, Staff queue reload must still discover the submitted server application through the existing queue API. Browser tests must prove page reload recovers the queue without relying on a realtime event.

## Amendment K — Plan self-review verification additions

Before implementation is declared complete, add these explicit checks to the final Plan-04 verification:

```bash
node --experimental-strip-types --test \
  tests/offline-membership-sync-core.test.mjs \
  tests/offline-membership-sync-api-contract.test.mjs \
  tests/offline-membership-sync-bridge-contract.test.mjs \
  tests/offline-membership-concurrency-contract.test.mjs \
  tests/registration-form-ui-contract.test.mjs \
  tests/reception-card-photo-gate-contract.test.mjs \
  tests/membership-print-a4-contract.test.mjs
```

Then run the full suite/typecheck/build/browser commands from the plan index. No Vercel deployment is needed to satisfy these gates.