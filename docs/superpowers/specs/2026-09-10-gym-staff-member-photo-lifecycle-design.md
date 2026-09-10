# BestGymsMalta Gym Staff Role & Official Member Photo Lifecycle — Design

## Status

Approved architectural refinement for Phase 2. This spec supersedes the configurable-per-gym staff permission model and expands the official member photo design. It does not authorize a Production merge or Production database migration.

## Goals

1. Reduce operational accounts to two effective roles: Gym Staff and Super Admin.
2. Keep exactly one shared operational login per gym, while keeping 2–3 individual Super Admin accounts.
3. Keep human accountability through required Staff Name fields on business actions that need attribution.
4. Make the member's official photo a front-desk identity-verification asset shown when a member scans their barcode.
5. Give migrated members with no usable photo a low-friction way to obtain one during normal visits.
6. Make photo capture mandatory for new memberships before activation, without allocating permanent BGM membership numbers early.

## Account Model

### Gym Staff

Each gym has one shared username/password. There are no individual staff profiles, no staff photos and no employee sub-login.

Gym Staff receives one fixed operational capability bundle. Super Admin does not configure arbitrary permission checkboxes per gym account.

The Gym Staff experience exposes the daily front-desk tools only:

- Memberships: NEW MEMBERSHIP and RENEWAL, including payment activation
- Reception / Barcode
- Sundries Order: fill and submit
- Bar List: fill and submit

The existing granular permission engine remains internally as route/API authorization infrastructure. A canonical server-side Gym Staff bundle is assigned to gym accounts automatically. The UI must not present permission editing for gym accounts.

Normal Gym Staff does not receive analytics, system-user management, notification settings, imports/exports, global order management or order-status management. The previously designed offline emergency roster is not part of the normal Gym Staff dashboard or fixed daily-access bundle unless it is separately re-approved.

### Super Admin

Super Admin accounts are individual accounts and bypass the Gym Staff bundle through the existing `isSuperAdmin` mechanism.

Super Admin has full access to all Gym Staff workflows plus:

- member and membership management across the network
- membership applications and activation history
- complete Sundries and Bar order lists/history and management
- notifications and notification settings
- check-in/access history
- analytics
- announcements
- membership import/export
- gym management
- system-user management

The database uniqueness rule allowing only one non-null `gym_id` system user per gym remains valid for shared gym logins.

## Staff Accountability

A shared gym login identifies the operating gym account, not the human employee.

The following membership actions require an entered human Staff Name:

- NEW MEMBERSHIP application submission
- RENEWAL application submission
- `PAYMENT RECEIVED — ACTIVATE`

Application Staff Name and Activation Staff Name remain separate audit fields because they may be different people.

Sundries and Bar submissions retain their existing required Staff Name fields.

Barcode scanning itself does not require a Staff Name because it is an access event rather than a business approval action.

There is no staff photograph anywhere in the system.

## Official Member Photo Purpose

The official member photo exists only for identity verification and member administration. It is separate from personal progress photos.

At reception, when an identified member scans their permanent barcode, staff must see:

- a large official member photo when available
- full name
- permanent BGM membership number
- membership expiry date
- clear ACTIVE / EXPIRED / INACTIVE state

Granted access uses a highly visible green state and success sound. Expired/inactive access uses a highly visible red state and warning sound. An identified expired/inactive member's photo is still shown so staff can confirm identity.

## Privacy & Storage

Official member photos are private assets.

- Store them in a private Supabase Storage bucket such as `bgm-member-photos`.
- Never expose the bucket publicly.
- Store only the object path in application/member database records.
- Staff/reception retrieves the image only through an authenticated server path or a short-lived signed URL after system authorization.
- Raw private object paths are not usable as public image URLs.
- The fixed Gym Staff role includes the internal authorization required to view official member photos during legitimate reception/member workflows.
- Super Admin can view official member photos through management workflows.

For permanent members, use stable per-member folders and versioned photo objects, for example:

`<membership-number>/official/<timestamp>.webp`

Do not overwrite a single public-style `photo.jpg`. Versioning avoids stale caches and preserves a controlled replacement history.

## Photo Provenance

The member record should retain the current `official_photo_path`. Add lightweight provenance sufficient for audit and migration reporting, including:

- photo capture/import timestamp
- source: `legacy_import`, `new_membership`, `renewal`, or `reception_capture`
- gym/system account responsible where applicable
- Staff Name where the surrounding business workflow already requires it

Do not create individual staff identity records merely to attribute photo capture.

## Existing Member Migration

Migration must not fail merely because an existing member has no photo.

### Existing Photos

If legacy photos can be exported, import a legacy photo only when it can be matched to one migrated member with high confidence using a stable legacy relationship available in the source data. Never guess from name alone, duplicated email, duplicated phone or ambiguous legacy `pkCustomer` values.

If a photo cannot be matched safely, leave `official_photo_path` empty and treat the member as requiring a new photo.

The migration report should count at least:

- members with safely imported photos
- members with no source photo
- photos/members requiring manual review because matching was ambiguous

### Missing Photo on First Visit

A migrated member keeps their permanent BGM membership number regardless of photo state.

When reception scans an identified member whose `official_photo_path` is empty:

- the membership state is calculated, but an active member does not yet receive a completed green `ACCESS GRANTED` result;
- no normal barcode check-in is created yet;
- the reception UI shows a prominent `PHOTO REQUIRED` state;
- for an active member, staff is guided immediately into camera capture on the front-desk tablet;
- the captured photo is reviewed with `Use Photo` / `Retake` controls;
- once confirmed, it is stored privately and attached to that existing permanent member identity;
- the server then re-validates the membership state and, if still active, finalizes the green access result and creates the canonical barcode check-in.

This makes photo capture part of the first successful identity-verification visit rather than an optional task performed after entry. The member is not issued a new number and no duplicate member record is created.

For an expired existing member with no photo, the scan remains denied and creates no normal check-in. The RENEWAL workflow requires photo capture before the renewed membership can be activated.

This approach progressively cleans the active database through ordinary visits instead of requiring a separate mass photo-registration campaign.

## New Membership Tablet Flow

NEW MEMBERSHIP is completed on the front-desk tablet. The enrollment wizard includes a mandatory official photo step.

Recommended sequence:

1. Membership type and duration
2. Personal/member details
3. Take Photo
4. Review application
5. Application Staff Name
6. Submit / print while awaiting payment
7. Activation Staff Name
8. `PAYMENT RECEIVED — ACTIVATE`

For Couples, each participant requires their own photo.

The Take Photo step opens the tablet camera and presents a simple preview with `Use Photo` and `Retake`.

A new application may hold its captured photo privately using the application/participant identity while it is still awaiting payment. Capturing a photo must not allocate a permanent BGM number.

At successful activation, the existing atomic activation transaction allocates the permanent BGM membership number and creates the permanent member record. The approved application photo is transferred/linked to that new member and its final permanent member folder/path is established as part of the activation workflow.

If activation fails, no permanent number or active membership is consumed. Application photo cleanup/retry must be safe and idempotent.

## Renewal Photo Flow

RENEWAL always reuses the existing permanent member identity and number.

- If the existing member already has an official photo, show it to staff for identity confirmation and keep it unless a replacement is intentionally captured.
- If there is no official photo, Take Photo becomes mandatory before activation.
- A replacement photo creates a new versioned object and updates `official_photo_path`; it does not change the permanent BGM number.

## Reception Barcode API & UI

The barcode lookup/access route determines membership state and records access/check-in events only after any required photo step is satisfied.

For identified members with a photo, its response provides a secure, short-lived representation of the official photo rather than only the private storage path.

The UI must retain a placeholder only as a fallback for missing/unavailable images. It must not use the member initial as the normal photo experience once an official photo exists.

The scanner must distinguish these cases clearly:

- ACTIVE + photo available: green access result with photo and canonical barcode check-in
- ACTIVE + no photo: `PHOTO REQUIRED`; no normal check-in until capture succeeds and access is revalidated
- EXPIRED/INACTIVE + photo available: red denied result with photo and no normal check-in
- EXPIRED/INACTIVE + no photo: red denied result plus photo-required marker; renewal captures photo before activation
- unknown barcode: no member photo and no normal check-in

## Data Integrity Rules

- Permanent BGM membership numbers are never generated solely for photo naming.
- A new person's permanent number is allocated only inside successful membership activation.
- Existing members never receive replacement numbers because a photo is missing or replaced.
- Couples members remain separate permanent identities, each with their own number and photo.
- A photo is linked to the permanent member identity, not to one membership period; renewals retain the same official photo unless replaced.
- Legacy photo matching must never be performed from ambiguous identifiers.
- A missing-photo capture must not create duplicate access/check-in events when the access decision is finalized after capture.

## Error Handling

- Camera permission denied: keep the application/member in photo-required state and offer Retry; do not silently bypass a mandatory new-member/renewal/first-visit photo.
- Upload fails: retain the local preview long enough to retry where practical; do not activate a new/renewed membership that requires a photo, or finalize a first-visit check-in, until storage succeeds.
- Signed photo URL fails for a member whose photo path exists: show a clear photo-unavailable fallback without changing the underlying membership state; allow staff to retry and flag/re-capture a genuinely missing/corrupt asset. Do not silently treat a failed image download as proof that no photo exists.
- Activation transaction fails: preserve the awaiting-payment application and application photo; do not consume a permanent number outside the transaction.
- Legacy photo match ambiguous: report for review and leave the permanent member without a photo rather than guessing.

## Testing & Verification

Implementation follows TDD.

Tests must cover at least:

- fixed Gym Staff permission assignment enforced server-side
- one gym login per gym remains enforced
- gym account UI has no arbitrary permission editor
- Super Admin retains unrestricted access
- new application cannot activate without required photo after the photo feature is enabled
- photo capture does not allocate a permanent number
- activation transfers the approved application photo to the new permanent member
- renewal reuses the existing permanent number and photo
- missing-photo migrated member enters `PHOTO REQUIRED` workflow after barcode identification
- active missing-photo scan creates no normal check-in before capture
- successful capture revalidates access and creates exactly one canonical barcode check-in
- barcode response never exposes a public raw photo path as the display mechanism
- expired identified member still displays their photo when available
- unknown barcode never creates a normal check-in
- legacy photo migration only auto-links deterministic matches
- private Storage access cannot be retrieved anonymously

Run the full existing CI suite after the focused tests pass. Validate all schema/storage changes in the Development Supabase project only. Production database, Production Vercel deployment and `main` remain untouched until explicit Preview approval.

## Implementation Boundary

This design is intentionally limited to the account-role simplification and official member photo lifecycle. It does not redesign unrelated member-app features, change membership pricing, introduce staff biometric identity, add public profile photos, or change the permanent membership-number allocation policy.