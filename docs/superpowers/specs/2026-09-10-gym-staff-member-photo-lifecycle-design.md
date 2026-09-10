# BestGymsMalta Gym Staff Role & Official Member Photo Lifecycle — Design

## Status

Approved architectural refinement for Phase 2. This spec supersedes the configurable-per-gym staff permission model and expands the official member photo design. It also incorporates the decision that operational membership/card numbers come from preprinted physical cards scanned by reception rather than from a generated `BGMxxxxxxx` sequence.

It does not authorize a Production merge or Production database migration.

## Goals

1. Reduce operational accounts to two effective roles: Gym Staff and Super Admin.
2. Keep exactly one shared operational login per gym, while keeping 2–3 individual Super Admin accounts.
3. Keep human accountability through required Staff Name fields on business actions that need attribution.
4. Make the member's official photo a front-desk identity-verification asset shown when a member scans their physical or virtual barcode.
5. Give migrated members with no usable photo a low-friction way to obtain one during normal visits.
6. Make photo capture mandatory for new memberships before activation.
7. Keep photo identity attached to the permanent internal member record even if the member's physical card/barcode is later replaced.
8. Require a card scan on every renewal so reception explicitly confirms whether the member keeps the existing card or receives a replacement.

## Account Model

### Gym Staff

Each gym has one shared username/password. There are no individual staff profiles, no staff photos and no employee sub-login.

Gym Staff receives one fixed operational capability bundle. Super Admin does not configure arbitrary permission checkboxes per gym account.

The Gym Staff experience exposes the daily front-desk tools only:

- Memberships: NEW MEMBERSHIP and RENEWAL, including payment activation
- Reception / Barcode
- Issue New Card
- Sundries Order: fill and submit
- Bar List: fill and submit

`Issue New Card` is available for lost, stolen or damaged cards and always works against an already verified permanent member identity.

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
- standalone `ISSUE NEW CARD` confirmation

Application Staff Name and Activation Staff Name remain separate audit fields because they may be different people.

Sundries and Bar submissions retain their existing required Staff Name fields.

Ordinary access scanning itself does not require a Staff Name because it is an access event rather than a business approval action.

There is no staff photograph anywhere in the system.

## Permanent Person Identity vs Card Identity

The permanent identity of a member is the internal `bgm_members.id` UUID. This identity never changes and owns the member's photo, history, memberships, check-ins and app data.

The barcode printed on a physical card is a replaceable access credential attached to that person. It is not the database primary identity.

This distinction is important because a lost, stolen or damaged card can be replaced without changing the member's permanent person record or historical data.

## Official Member Photo Purpose

The official member photo exists only for identity verification and member administration. It is separate from personal progress photos.

At reception, when an identified member scans their physical card or matching virtual barcode, staff must see:

- a large official member photo when available
- full name
- currently assigned card/membership barcode value
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

For permanent members, use the immutable internal member UUID in stable folders, for example:

`<member-uuid>/official/<timestamp>.webp`

Do not use the physical card barcode as the photo folder identity because that barcode may change when a card is replaced. Do not overwrite a single public-style `photo.jpg`. Versioning avoids stale caches and preserves a controlled replacement history.

## Photo Provenance

The member record should retain the current `official_photo_path`. Add lightweight provenance sufficient for audit and migration reporting, including:

- photo capture/import timestamp
- source: `legacy_import`, `new_membership`, `renewal`, or `reception_capture`
- gym/system account responsible where applicable
- Staff Name where the surrounding business workflow already requires it

Do not create individual staff identity records merely to attribute photo capture.

## Existing Member Migration

Migration must not fail merely because an existing member has no photo or no safely known physical-card barcode.

### Existing Photos

If legacy photos can be exported, import a legacy photo only when it can be matched to one migrated member with high confidence using a stable legacy relationship available in the source data. Never guess from name alone, duplicated email, duplicated phone or ambiguous legacy `pkCustomer` values.

If a photo cannot be matched safely, leave `official_photo_path` empty and treat the member as requiring a new photo.

The migration report should count at least:

- members with safely imported photos
- members with no source photo
- photos/members requiring manual review because matching was ambiguous

### Missing Photo on First Visit

A migrated member keeps the same permanent internal person identity regardless of photo or card-link state.

When reception identifies an active member whose `official_photo_path` is empty:

- the membership state is calculated, but the member does not yet receive a completed green `ACCESS GRANTED` result;
- no normal barcode check-in is created yet;
- the reception UI shows a prominent `PHOTO REQUIRED` state;
- staff is guided immediately into camera capture on the front-desk tablet/reception device;
- the captured photo is reviewed with `Use Photo` / `Retake` controls;
- once confirmed, it is stored privately and attached to that existing permanent member UUID;
- the server then re-validates the membership state and, if still active, finalizes the green access result and creates the canonical barcode check-in.

This makes photo capture part of the first successful identity-verification visit rather than an optional task performed after entry. No duplicate member record is created.

For an expired existing member with no photo, the scan remains denied and creates no normal check-in. The RENEWAL workflow requires photo capture before the renewed membership can be activated.

This approach progressively cleans the active database through ordinary visits instead of requiring a separate mass photo-registration campaign.

## New Membership Tablet Flow

NEW MEMBERSHIP is completed on the front-desk tablet. The enrollment wizard includes a mandatory official photo step.

Recommended tablet sequence:

1. Membership type and duration
2. Personal/member details
3. Take Photo
4. Review application
5. Application Staff Name
6. Submit application

For Couples, each participant requires their own photo.

The Take Photo step opens the tablet camera and presents a simple preview with `Use Photo` and `Retake`.

The application photo is stored privately against the temporary application/participant identity. Taking the photo does not itself create an active member or assign a physical card barcode.

## Main Reception Card-Assignment Notification

After a new application is submitted from the tablet, the gym's main staff/reception screen receives a prominent pending action such as:

`NEW MEMBERSHIP READY — SCAN CARD`

Opening that action must show the applicant's name and official photo so staff can verify which person is being assigned the card.

Staff scans an unused preprinted physical membership card with the reception barcode reader. The exact decoded barcode value is reserved for that application/participant after the server verifies that it is not already active/reserved/retired for another person.

For Couples, the screen assigns one physical card to each participant and clearly pairs each scan with that participant's name and photo.

A wrong-card/rescan action is allowed before activation so an accidental scan does not permanently attach the wrong physical card. Once the membership is activated and the card is issued, that barcode must never be silently reassigned to another person.

## Activation

After the required photo(s) and card assignment(s) are complete, staff enters Activation Staff Name and presses the exact button:

`PAYMENT RECEIVED — ACTIVATE`

Successful activation atomically:

- creates/activates the permanent member identity as applicable;
- creates the membership period;
- turns the reserved physical card credential into the member's active credential;
- transfers/links the approved application photo to the permanent member UUID;
- records staff/system audit context.

If activation fails, the application remains awaiting payment/retry and does not create a partially active member/card relationship.

## Renewal Photo and Card Flow

RENEWAL always reuses the existing permanent member UUID and always requires reception to scan a physical card before activation.

The required renewal card scan is a deliberate verification step:

- If the scanned barcode exactly matches the member's current active card, the renewal keeps that same card and same barcode.
- If the scanned barcode is a different unused preprinted card, the UI clearly treats this as `NEW CARD ON RENEWAL` and asks staff to confirm the replacement.
- The old card is not retired merely because a different card was scanned during an unfinished renewal. It is retired permanently only when the renewal successfully activates with the confirmed replacement card.
- At successful replacement renewal, the old barcode becomes `retired`, the new barcode becomes active for the same permanent member UUID, and the member app switches to the new barcode.
- If the different scanned barcode is already reserved, active, or retired for another member/card history, the scan is rejected.

The member can initially be found through their old/current card, their virtual card, or fallback member search, but the explicit renewal card scan remains mandatory before activation.

Photo behavior during renewal:

- If the member already has an official photo, show it to staff for identity confirmation and keep it unless a replacement is intentionally captured.
- If there is no official photo, Take Photo becomes mandatory before renewal activation.
- A replacement photo creates a new versioned object and updates `official_photo_path`; it does not change the member UUID or card barcode by itself.

An expired membership does not automatically retire its card. The card can still identify the member but access is denied until renewal. After successful renewal, either the re-scanned existing card becomes usable again or the confirmed new card becomes the active credential.

## Standalone `Issue New Card`

Gym Staff has a dedicated `Issue New Card` action for a member whose current card is lost, stolen or damaged outside the renewal flow.

Flow:

1. Find/verify the existing member.
2. Show the official photo, current card number and membership status.
3. Enter required Staff Name.
4. Scan a new unused preprinted card.
5. Show old card -> new card and require explicit confirmation.
6. Atomically retire the old barcode and activate the new barcode for the same permanent member UUID.
7. Update the member app's virtual card to use the new active barcode immediately on its next authenticated refresh/request.

The old barcode is permanently retired and must never grant access or be silently reassigned to another member.

Card replacement does not renew, extend or otherwise change membership dates/status. It changes only the access credential.

## Member App Virtual Card

The member app must display a virtual barcode containing the exact currently active physical-card barcode value assigned to that member.

The virtual barcode is an alternate presentation of the same credential, not a second membership number. If the member forgets the physical card, reception can scan the barcode displayed on the member's phone and obtain exactly the same member/access result.

Rules:

- The app must obtain the currently active card credential from the authenticated server/member session.
- Do not derive a new `BGMxxxxxxx` barcode for the app.
- Do not rely on stale localStorage as the source of truth for the barcode.
- A renewal that re-scans the same card leaves the virtual barcode unchanged.
- A renewal that confirms a replacement card updates the virtual card to the new barcode.
- A standalone `Issue New Card` action updates the virtual card to the new barcode.
- Retired barcodes must no longer grant access.
- If a migrated member has not yet had a physical card barcode linked, the virtual card must not fabricate one. Show a clear `CARD NOT LINKED — ASK RECEPTION` state until assignment is completed.

The virtual barcode may be rendered as Code 128 using the exact decoded physical-card payload, provided reception hardware testing confirms the scanners reliably read it from phone screens.

## Reception Barcode API & UI

The barcode lookup/access route resolves the scanned credential to its linked permanent member UUID, then determines membership state and records access/check-in events only after any required photo step is satisfied.

For identified members with a photo, its response provides a secure, short-lived representation of the official photo rather than only the private storage path.

The UI must retain a placeholder only as a fallback for missing/unavailable images. It must not use the member initial as the normal photo experience once an official photo exists.

The scanner must distinguish these cases clearly:

- ACTIVE + valid active card + photo available: green access result with photo and canonical barcode check-in
- ACTIVE + valid active card + no photo: `PHOTO REQUIRED`; no normal check-in until capture succeeds and access is revalidated
- EXPIRED/INACTIVE + identified card + photo available: red denied result with photo and no normal check-in
- EXPIRED/INACTIVE + identified card + no photo: red denied result plus photo-required marker; renewal captures photo before activation
- RETIRED/REPLACED card: red `CARD REPLACED` / disabled result and no normal check-in
- unknown barcode: no member photo and no normal check-in

## Data Integrity Rules

- The permanent person identity is the member UUID, not the physical card barcode.
- Physical card barcode values are opaque text credentials; preserve the exact scanned payload including leading zeroes.
- A currently active/reserved barcode cannot be assigned to two people/applications.
- Once an issued card is retired/replaced, its barcode is permanently retired and never silently reassigned to another person.
- Every renewal requires a card scan before activation.
- Re-scanning the current card on renewal preserves the same card relationship.
- A replacement-card renewal retires the old card only inside the successful activation boundary.
- Standalone card replacement changes credentials only and does not alter membership dates.
- Couples members remain separate permanent identities, each with their own card credential and photo.
- A photo is linked to the permanent member UUID, not to one membership period or replaceable card.
- Legacy photo/card matching must never be performed from ambiguous identifiers.
- A missing-photo capture must not create duplicate access/check-in events when the access decision is finalized after capture.

## Error Handling

- Camera permission denied: keep the application/member in photo-required state and offer Retry; do not silently bypass a mandatory new-member/renewal/first-visit photo.
- Upload fails: retain the local preview long enough to retry where practical; do not activate a new/renewed membership that requires a photo, or finalize a first-visit check-in, until storage succeeds.
- Card already assigned/reserved/retired incompatibly: reject the scan clearly and do not modify either member/application.
- Wrong card scanned before activation: allow staff to release/correct the unactivated reservation and rescan.
- Different card scanned on renewal: require explicit replacement confirmation; do not retire the current card until activation succeeds.
- Signed photo URL fails for a member whose photo path exists: show a clear photo-unavailable fallback without changing the underlying membership state; allow staff to retry and flag/re-capture a genuinely missing/corrupt asset.
- Activation transaction fails: preserve the awaiting-payment application, photo and existing active card; do not leave a partially activated credential.
- Standalone replacement fails: preserve the old active card unless the entire replacement transaction commits successfully.
- Legacy photo/card match ambiguous: report for review rather than guessing.

## Testing & Verification

Implementation follows TDD.

Tests must cover at least:

- fixed Gym Staff permission assignment enforced server-side
- one gym login per gym remains enforced
- gym account UI has no arbitrary permission editor
- Super Admin retains unrestricted access
- new application cannot activate without required photo/card assignment
- photo capture does not activate a member or assign a fabricated BGM number
- scanned preprinted card payload is preserved exactly
- duplicate/reserved/retired card assignment is rejected appropriately
- activation attaches the approved application photo and reserved card to the correct permanent member UUID
- Couples activation requires and preserves separate photo/card assignment per participant
- renewal always requires a card scan
- renewal with the same card keeps the same member UUID and barcode
- renewal with a different unused card retires the old barcode only after successful activation and activates the new one
- failed/cancelled replacement renewal leaves the old card active
- standalone `Issue New Card` keeps the same member UUID and membership dates while retiring the old barcode
- replacement retires the old barcode and updates the member app to the new active barcode
- member app virtual barcode payload equals the exact active physical-card payload
- member app never fabricates a barcode when no card is linked
- missing-photo migrated member enters `PHOTO REQUIRED` workflow after barcode identification
- active missing-photo scan creates no normal check-in before capture
- successful capture revalidates access and creates exactly one canonical barcode check-in
- barcode response never exposes a public raw photo path as the display mechanism
- expired identified member still displays their photo when available
- retired/unknown barcode never creates a normal check-in
- legacy photo/card migration only auto-links deterministic matches
- private Storage access cannot be retrieved anonymously

Run the full existing CI suite after the focused tests pass. Validate all schema/storage changes in the Development Supabase project only. Production database, Production Vercel deployment and `main` remain untouched until explicit Preview approval.

## Implementation Boundary

This design is intentionally limited to the account-role simplification, official member photo lifecycle and the relationship between member identity and scanned preprinted membership cards. It does not redesign unrelated member-app features, change membership pricing, introduce staff biometric identity, add public profile photos or authorize Production changes.