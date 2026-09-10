# BestGymsMalta Member Identity, Preprinted Card, XLSX Transition & Barcode Access — Design

## Status

Approved Phase 2 design on branch `phase-2-operations-nfc-redesign`.

This revision supersedes the earlier generated `BGM0000001` membership-number model. BestGymsMalta uses physical membership cards with preprinted barcodes, so the operational membership/card number comes from the exact barcode scanned from the physical card at reception.

NFC work may remain dormant for possible future use, but NFC is not part of the initial rollout. Production remains untouched until explicit Preview approval.

## Goal

Create one permanent internal BestGymsMalta member identity that survives expiry, renewal and card replacement; migrate the existing membership database safely; use preprinted physical-card barcodes as access credentials; require explicit card verification on every renewal; and mirror the currently active physical-card barcode in the member app so the phone can substitute when the member forgets the card.

## Permanent Person Identity

Every person has one permanent internal member identity: `bgm_members.id` (UUID).

That UUID is the canonical identity for the member's profile, official photo, legacy references, app account/session, membership history, check-ins, progress/trainer data, and current/historical card credentials.

Expiry, renewal, a lost card, or a replacement card never creates a new person merely to change access credentials.

## Physical Card Barcode

The barcode value decoded from a preprinted physical membership card is the visible operational membership/card number used at reception and on the member's virtual card.

Rules:

- Treat the barcode as opaque text.
- Preserve its exact decoded payload, including leading zeroes and valid letters.
- Do not manufacture a `BGM` prefix or generate sequential membership numbers.
- Do not assign a barcode during tablet data entry.
- New card assignment requires scanning the actual physical card on the main staff/reception screen.
- An active or reserved card barcode must be globally unique.
- A retired/replaced issued barcode is permanently retired and must never be silently assigned to another person.
- `bgm_members.member_number` may remain temporarily as a compatibility mirror of the current active card value while Phase 2 code is transitioned, but card history must live in a dedicated credential model.

## Card Credential Lifecycle

The normalized card record is linked to the permanent member UUID and contains the exact barcode plus lifecycle/audit information.

Conceptually it stores:

- card record ID
- exact `barcode_value`
- permanent member UUID when issued
- pending application/participant reference while reserved before activation
- status: `reserved`, `active`, or `retired`
- reserve/issue/retire timestamps
- retirement/replacement reason
- gym/system-user and Staff Name audit context where appropriate

Only one active physical-card barcode is expected per member for launch.

## New Membership Flow

### Tablet

The member completes the new-membership application on the front-desk tablet:

1. Select membership type and duration.
2. Enter personal/member details.
3. Take mandatory official member photo.
4. Review the application.
5. Enter Application Staff Name.
6. Submit.

The tablet does not create or invent a card number.

### Main Staff Screen

Submission creates a prominent gym-specific action on the main reception screen:

`NEW MEMBERSHIP READY — SCAN CARD`

Opening it shows the applicant's name and photo.

Staff scans an unused preprinted physical card. The server validates the exact payload and reserves it to that application participant.

If the scanned card is already reserved, active, or permanently retired in a conflicting history, assignment is rejected clearly.

Before activation, an accidentally scanned unused card may be released and replaced with another scan.

For Couples memberships, each participant has their own photo, permanent internal member UUID and physical card. The UI must make it impossible to confuse Card 1 and Card 2 by showing the participant name/photo beside each required scan.

### Activation

When all required photo/card assignments are satisfied, staff enters Activation Staff Name and presses exactly:

`PAYMENT RECEIVED — ACTIVATE`

Activation atomically creates/activates the permanent member identity/membership period and promotes the reserved card credential to active. Printing never activates membership.

A failed activation must not leave a partially active member/card relationship.

## Renewal

Every renewal reuses the same permanent member UUID and **requires an explicit physical-card scan before activation**.

The member may initially be found by scanning the current physical card, scanning the virtual card from the member app, or fallback search. Regardless of how the renewal was opened, the renewal workflow still requires a card scan as its own verification/assignment step.

### Renewal with Same Card

If the card scanned during renewal exactly matches the member's current active card:

- keep the same card record/barcode;
- keep the same virtual barcode in the member app;
- create the new membership period only after payment activation;
- expired status does not retire the card, so the same barcode becomes usable again after renewal.

### Renewal with New Card

If staff scans a different unused preprinted card:

- show a clear `NEW CARD ON RENEWAL` state;
- show old barcode -> new barcode and require staff confirmation;
- reserve the new card to the renewal application;
- do not retire the old card while the renewal remains unfinished;
- on successful `PAYMENT RECEIVED — ACTIVATE`, atomically retire the old card permanently and activate the new card for the same member UUID;
- update the member app to the new barcode on its next authenticated refresh/request.

If the renewal is cancelled or activation fails, the old card remains the member's current credential and the new reservation is safely released/handled. An unfinished renewal must never accidentally disable the member's existing card.

If the newly scanned card is already active, reserved, or retired in another credential history, reject it.

## Standalone `Issue New Card`

Gym Staff has an `Issue New Card` action on the main staff interface for lost, stolen or damaged cards. This action changes only the access credential; it does **not** renew or extend membership.

Flow:

1. Find/verify the existing member.
2. Show official member photo, current card number, status and expiry.
3. Enter required Staff Name.
4. Scan a new unused preprinted card.
5. Server verifies the new barcode is safe to issue.
6. Show old card -> new card and require explicit confirmation.
7. Atomically retire the old barcode permanently and activate the new barcode for the same permanent member UUID.
8. The member app uses the new barcode from then on.

The old barcode must immediately stop granting access after the successful replacement transaction and must never later become another member's valid card.

## Official Member Photo

Official member photos are private identity-verification assets linked to the permanent member UUID, not to a replaceable card.

New applications require a photo before activation. Existing migrated members can receive a photo through the approved first-visit/renewal workflow. A card replacement alone does not require a new photo if the existing official photo is valid.

Detailed rules are defined in `2026-09-10-gym-staff-member-photo-lifecycle-design.md`.

## Member App Virtual Card

The virtual card displays the exact currently active physical-card barcode payload assigned to the authenticated member.

It is not a second credential and not a separately generated number. The phone is simply another visual representation of the same active barcode, allowing reception to scan the mobile screen when the physical card has been forgotten.

The virtual card displays:

- member name
- membership status
- expiry date
- current card/membership number
- scannable barcode generated from the exact active physical-card payload

Rules:

- Read the active credential from the authenticated server/member session.
- Never derive a `BGMxxxxxxx` barcode.
- Never rely on stale localStorage as the source of truth.
- Same-card renewal leaves the virtual barcode unchanged.
- Replacement during renewal switches the virtual barcode to the new active card after successful activation.
- Standalone `Issue New Card` switches the virtual barcode after successful replacement.
- Retired barcodes stop granting access.
- If a migrated member has no linked card, show `CARD NOT LINKED — ASK RECEPTION`; do not fabricate a barcode.

The virtual barcode may be rendered as Code 128 using the exact decoded card payload, provided Preview testing with the real reception scanners confirms reliable phone-screen scanning. The visual bars need not be identical to the physical printing; the decoded payload must be identical.

## Reception Barcode Access

Preferred scanners are standard USB/Bluetooth barcode readers operating in keyboard-emulation mode.

Access resolution is:

`scanned payload -> card credential -> permanent member UUID -> current membership -> official photo -> access decision -> check-in`

For a valid active member with photo:

- show large member photo
- name
- current card/membership number
- expiry
- large green `ACTIVE`
- success sound
- create exactly one canonical check-in with `source = 'barcode'`

For expired/inactive members:

- still identify the member through the known card
- show photo when available
- show large red `EXPIRED` / inactive state and expiry/reason
- warning sound
- create no granted check-in

For a retired/replaced card:

- show `CARD REPLACED` / disabled state
- create no granted check-in
- preserve the old card in historical audit rather than treating it as unused inventory

For an unknown barcode:

- show `MEMBER/CARD NOT FOUND`
- create no normal check-in

If an active migrated member is missing an official photo, access pauses at `PHOTO REQUIRED`; no normal green check-in is finalized until photo capture succeeds and the server revalidates access.

## Legacy `pkCustomer`

`pkCustomer` remains a legacy reference and is not a globally unique identity.

- Preserve it with source gym/context.
- Never merge members using `pkCustomer` alone.
- The permanent internal UUID is the BGM person identity.
- The current physical-card barcode is the operational membership/access number when safely linked.
- Ambiguous legacy matches go to review rather than being guessed.

## Source Workbook

The old-system workbook contains these 15 columns:

1. `Gym`
2. `pkCustomer`
3. `CustomerName`
4. `CompanyName`
5. `Address1`
6. `Address2`
7. `Town`
8. `PostCode`
9. `Gender`
10. `TelephoneNo1`
11. `TelephoneNo2`
12. `Mobile`
13. `Email`
14. `ExpiryDate1`
15. `ValidYN`

These fields do not, by themselves, establish a physical-card barcode. The importer must not fabricate one.

## BGM Transition Workbook

The revised BGM exchange workbook contains:

1. `CardBarcode`
2. `Gym`
3. `pkCustomer`
4. `CustomerName`
5. `CompanyName`
6. `Address1`
7. `Address2`
8. `Town`
9. `PostCode`
10. `Gender`
11. `TelephoneNo1`
12. `TelephoneNo2`
13. `Mobile`
14. `Email`
15. `ExpiryDate1`
16. `ValidYN`

`CardBarcode` is text and may be blank for migrated members whose physical card cannot yet be linked deterministically. Leading zeroes must always be preserved.

This `CardBarcode` contract supersedes the earlier leading `MembershipNumber` column.

## Existing-Member Migration

Migration creates/preserves permanent internal member UUIDs without generating artificial BGM numbers.

For each safely accepted historical member:

- import profile and legacy data;
- preserve membership expiry/status;
- import/link a physical-card barcode only if a trustworthy source provides a deterministic member-to-card mapping;
- otherwise leave `CardBarcode` blank and link their current card at reception later;
- import an existing member photo only when matched deterministically;
- otherwise collect the photo on first successful visit or renewal.

If the old system cannot export card mappings, no mass reissue is required. Staff can locate the migrated member and scan their existing physical card on their next visit.

## Import Safety

Normal import remains staged and non-destructive:

`Upload -> Parse -> Validate -> Match -> Preview -> Confirm -> Apply`

Preview reports at least:

- total rows
- existing matches
- unchanged rows
- updates
- new legacy people
- safely linked card barcodes
- blank/unlinked card barcodes
- conflicts/ambiguous rows
- invalid rows
- deletions: always zero

Rows omitted from an upload are never automatically deleted, archived or deactivated.

Matching rules:

- A present `CardBarcode` may be used only when already known to that same member or supported by deterministic legacy evidence.
- A barcode associated with another member/application/history is a conflict and is never silently moved.
- Blank card barcode does not force a duplicate person; use legacy linkage and supporting data conservatively.
- Ambiguous identity remains `Needs review` with no destructive mutation.

## Pilot Rollout

The pilot gym can create new members directly in BGM using tablet application + reception card scanning while other gyms remain on the old system.

Later XLSX exports reconcile old-system data conservatively. Existing BGM members retain their UUID/current card relationship. New imported members without a known card stay unlinked until reception scans their existing physical card.

Because the application no longer generates visible member numbers, there is no generated-number collision between pilot enrollments and old-system imports. Card uniqueness is validated against the live database when a card is scanned/imported.

## Import / Export

Super Admin supports:

- controlled initial 15-column XLSX/CSV legacy import;
- revised 16-column BGM XLSX/CSV exchange format with leading `CardBarcode`;
- corresponding XLSX/CSV export.

Exports preserve barcode values as text exactly, including leading zeroes, and leave them blank when no card is linked.

Formula cells must be handled safely and never executed as arbitrary server code.

## NFC Future Compatibility

Dormant NFC tables/routes may remain. If NFC is enabled later, an NFC credential can point to the same permanent member UUID alongside barcode cards without changing member identity.

## Audit Requirements

Audit at least:

- new/renewal application submission and Staff Name
- new card reservation/assignment
- renewal card verification
- same-card renewal result
- replacement-card renewal result
- wrong-card correction before activation
- membership activation and Activation Staff Name
- standalone `Issue New Card` and Staff Name
- old-card retirement
- bulk import/conflict outcomes
- critical member/status changes

## Error Handling

- Preserve exact barcode text and leading zeroes.
- Reject duplicate/reserved/conflicting barcode assignment immediately.
- Do not silently move an issued or retired barcode between members.
- Do not retire the current card until a replacement transaction/renewal activation successfully commits.
- Failed/cancelled renewal with a proposed replacement leaves the old card active/known exactly as before.
- Failed standalone replacement leaves the old card unchanged.
- Do not fabricate barcode values for migrated/unlinked members.
- Do not guess ambiguous legacy matches.
- Normal import never deletes omitted members.

## Testing Requirements

Implementation is test-first. Minimum automated coverage includes:

- permanent member UUID survives expiry, renewal and card replacement
- exact barcode payload/leading zero preservation
- duplicate/reserved/retired credential rejection
- tablet application creates no fabricated BGM number
- new membership requires physical card assignment before activation
- Couples requires separate cards
- every renewal requires a card scan
- same-card renewal keeps the same barcode
- new-card renewal retires the old barcode only after successful activation
- failed/cancelled replacement renewal leaves old card intact
- expired card identifies the member but does not grant access before renewal
- standalone `Issue New Card` changes only the credential, not membership dates
- retired card never grants access
- virtual member card equals the exact active physical-card payload
- virtual card changes after replacement and remains unchanged after same-card renewal
- unlinked member app fabricates no barcode
- revised 16-column `CardBarcode` exchange contract and 15-column legacy path
- XLSX/CSV text/date/blank handling and round trip
- omitted rows cause zero deletions
- ambiguous legacy match stops for review
- barcode access grants/denies correctly and uses canonical check-in pipeline
- NFC remains dormant without breaking schema/build

Preview testing must use actual preprinted membership cards plus representative phones showing the virtual barcode to confirm the real scanners can read both reliably.

## Deployment Safety

- Work only on `phase-2-operations-nfc-redesign`.
- Never write directly to `main`.
- Schema changes are authored/tested in Development first.
- The development-only generated `BGMxxxxxxx` allocator must be retired through a reviewed migration rather than patched ad hoc.
- Normal imports are non-destructive.
- Production merge/database migration occurs only after explicit Preview acceptance.
- Sensitive membership workbook data is never committed to the public repository.

## Success Criteria

The design succeeds when:

1. Every person has one permanent internal identity independent of cards.
2. New members receive the exact preprinted card barcode scanned by staff.
3. Every renewal explicitly scans a physical card.
4. Same-card renewal preserves the card; different-card renewal retires the old card and activates the new one only on successful renewal activation.
5. Staff can issue a replacement card at any time without changing membership dates/history.
6. Existing members migrate without fabricated numbers and can link existing cards progressively.
7. The member app always displays the exact current active card barcode so a phone can substitute for the physical card.
8. Reception provides immediate photo-backed active/expired feedback and canonical check-in behavior.
9. XLSX/CSV transition remains conservative, non-destructive and preserves barcode text exactly.
10. NFC can be added later without redesigning permanent member identity.