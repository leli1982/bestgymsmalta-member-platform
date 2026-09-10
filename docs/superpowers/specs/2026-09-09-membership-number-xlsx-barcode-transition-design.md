# BestGymsMalta Member Identity, Preprinted Card, XLSX Transition & Barcode Access — Design

## Status

Approved Phase 2 design on branch `phase-2-operations-nfc-redesign`.

This revision supersedes the earlier generated `BGM0000001` membership-number model. BestGymsMalta currently uses physical membership cards with preprinted barcodes. New operational card/membership numbers therefore come from the exact barcode scanned from the physical card at reception.

Existing NFC schema/code may remain dormant for possible future use, but NFC is not part of the initial rollout. Production remains untouched until explicit Preview approval.

## Goal

Create one permanent internal BestGymsMalta member identity that survives expiry, renewal and card replacement; migrate the existing membership database safely; support a staged one-gym-at-a-time rollout; use preprinted physical-card barcodes as the operational access credential; and mirror the currently active physical-card barcode in the member app so the phone can be scanned when the physical card is forgotten.

## Permanent Person Identity

Every person has one permanent internal member identity: `bgm_members.id` (UUID).

That UUID is the canonical identity for:

- member profile/contact data
- official member photo
- legacy references
- member-app account/session linkage
- membership history
- check-ins/access history
- progress/trainer/other member data
- current and historical physical-card credentials

Expiry, renewal, a lost card or a replacement card never creates a new person record merely to change access credentials.

## Physical Card Barcode as Operational Membership/Card Number

The value decoded from the preprinted physical membership card is the visible operational membership/card number used at reception and on the member's virtual card.

Rules:

- Treat the scanned barcode payload as opaque text.
- Preserve the exact decoded value, including leading zeroes and any valid letters.
- Do not manufacture a `BGM` prefix or generate a sequential number for new members.
- Do not allocate a card value during tablet data entry.
- A card value must be captured by scanning the actual preprinted card at the reception/main staff screen.
- An active/reserved card value must be globally unique across BGM.
- A normal renewal keeps the same card and barcode.
- A lost/stolen/damaged card may be replaced without changing the permanent member UUID or historical data.
- A retired/replaced issued barcode must not silently become another person's card later.

The existing `bgm_members.member_number` field may remain temporarily as a compatibility mirror of the current active card barcode while Phase 2 code is transitioned, but the long-term card lifecycle should be modeled separately so replacements retain history rather than overwriting identity.

## Card Credential Lifecycle

Introduce/normalize a card-credential model linked to the permanent member UUID.

Conceptual record fields include:

- card record ID
- exact `barcode_value`
- member UUID when issued
- pending application/participant reference when reserved before activation
- status such as `reserved`, `active`, `retired`
- assigned/reserved timestamp
- activated timestamp
- retired timestamp/reason
- gym/system-user audit context

Only one active physical-card barcode is expected per member for launch.

### Wrong Card Before Activation

If staff accidentally scans the wrong unused card while a membership is still awaiting activation, the unactivated reservation may be corrected/rescanned. The system must clearly show the applicant name/photo and the scanned barcode before activation.

### Replacement Card

For a lost, stolen or damaged issued card:

1. Staff verifies the existing member.
2. Staff scans a new unused preprinted card.
3. Server verifies the new barcode is not already reserved/active/retired in a conflicting way.
4. Old card becomes `retired` / replaced and stops granting access.
5. New card becomes the active credential for the same permanent member UUID.
6. Member app automatically displays the new barcode on its virtual card.

## New Membership Flow

The front-desk tablet and main staff screen work together.

### Tablet

1. Choose `NEW MEMBERSHIP`.
2. Select membership type/duration.
3. Enter all member details.
4. Take mandatory official member photo.
5. Review application.
6. Enter Application Staff Name.
7. Submit application.

The tablet does not invent or assign a membership/card number.

### Main Staff/Reception Screen

After submission, the gym's main staff screen receives a prominent pending action:

`NEW MEMBERSHIP READY — SCAN CARD`

Opening it shows the applicant's name and photo.

Staff scans an unused preprinted card. The exact barcode value is checked for uniqueness and reserved to the correct application participant.

For Couples memberships, each person has their own permanent member UUID, official photo and physical card. The main screen must pair Card 1/Card 2 clearly with each participant's name/photo.

### Activation

When photo(s) and card assignment(s) are complete, staff enters Activation Staff Name and presses:

`PAYMENT RECEIVED — ACTIVATE`

Activation atomically creates/activates the member identity/membership period as appropriate and promotes the reserved physical card to that member's active credential. Printing never activates a membership.

If activation fails, the system must not leave a partially active member/card relationship.

## Renewal

Renewal reuses the existing permanent member UUID and normally the same existing card barcode.

The member can be found by:

1. scanning the current physical card barcode;
2. scanning the virtual barcode from the member app;
3. fallback search by name/mobile/email/legacy references, followed by explicit confirmation.

Renewal flow:

- identify and verify the existing member;
- show official photo/current card barcode/current expiry;
- choose new duration/start/expiry;
- capture a photo only when missing or intentionally replacing it;
- enter Application Staff Name;
- submit/review;
- enter Activation Staff Name;
- press `PAYMENT RECEIVED — ACTIVATE`;
- create a new membership period while keeping the same permanent member and current card.

An expired membership does not automatically retire the card. The barcode can still identify the member but access is denied until renewal. After successful renewal the same card works again.

## Member App Virtual Card

The member app's virtual card must display the exact currently active physical-card barcode payload assigned to that member.

The virtual barcode is not a second credential and not a generated alternative membership number. It is a digital presentation of the same credential stored for the physical card.

The virtual card displays:

- member name
- membership status
- expiry date
- current operational card/membership number
- scannable barcode generated from the exact active physical-card payload

If the member forgets the physical card, reception scans the phone and receives the same member/access result.

Rules:

- The authenticated server/member session is the source of truth for the active barcode.
- Do not trust stale client-side/localStorage member data as the canonical barcode source.
- Normal renewal leaves the virtual barcode unchanged.
- Card replacement updates the virtual card to the new barcode automatically.
- Retired barcode values stop granting access immediately.
- A migrated member with no linked card must not receive a fabricated app barcode. Show `CARD NOT LINKED — ASK RECEPTION` until a physical card is linked.
- The virtual barcode may use Code 128 to encode the exact card payload, provided hardware Preview testing confirms the reception scanners reliably read it from phone screens.

The physical barcode's printed symbology does not have to be visually reproduced pixel-for-pixel in the app; what must match exactly is the decoded credential payload that the scanner sends to the system.

## Reception Barcode Access

Preferred hardware is a standard USB/Bluetooth barcode reader operating in keyboard-emulation mode.

Access flow:

`scanned payload -> active/known card record -> permanent member UUID -> current membership state -> photo verification -> access decision -> canonical check-in`

Granted scan:

- show official member photo
- full name
- current card/membership number
- expiry
- large green `ACTIVE`
- success sound
- create canonical check-in with `source = 'barcode'`

Expired/inactive scan:

- show identified member/photo when available
- large red `EXPIRED` / inactive state
- expiry/reason
- warning sound
- no granted check-in
- offer renewal/member actions as permitted

Retired/replaced card:

- red `CARD REPLACED` / disabled state
- no normal check-in
- preserve auditable lookup/history rather than treating the old credential as reusable stock

Unknown barcode:

- clear `MEMBER/CARD NOT FOUND`
- no normal check-in
- log attempt where appropriate

## Official Photo Interaction

Official photos are private and belong to the permanent member UUID, not the replaceable card.

For a migrated active member with a linked card but no photo, barcode access pauses at `PHOTO REQUIRED`; no normal check-in is finalized until staff captures the official photo and access is revalidated.

For an expired member with no photo, access remains denied and renewal requires photo capture before activation.

The detailed photo lifecycle is defined in `2026-09-10-gym-staff-member-photo-lifecycle-design.md`.

## Legacy `pkCustomer`

`pkCustomer` belongs to the old membership system and is not a globally unique BGM identity.

Rules:

- Preserve `pkCustomer` as a legacy reference.
- Do not use `pkCustomer` alone as the permanent person key.
- Imported legacy records retain old-system context so duplicate PK values cannot merge unrelated people.
- Internal UUID becomes the canonical BGM person identity.
- Card barcode becomes the operational access/member number when safely linked.
- Ambiguous matches are sent to review rather than guessed.

## Source Workbook

The received old-system workbook contains one member-data sheet with these 15 columns, in this order:

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

The supplied 15-column workbook does not itself establish a physical-card barcode. The importer must not fabricate one.

## BGM Transition Workbook

The BGM migration/exchange workbook keeps the legacy fields and adds one leading BGM-managed field:

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

`CardBarcode` is stored/exported as text so leading zeroes are preserved. It may legitimately be blank for migrated members whose existing physical card has not yet been safely linked.

This revised 16-column BGM exchange contract supersedes the earlier leading `MembershipNumber` column.

## Existing-Member Migration

The controlled migration creates/preserves permanent internal member UUIDs without generating artificial BGM membership numbers.

For each safely accepted historical member:

- import their member/profile/legacy data;
- preserve expiry/status information;
- import/link an existing card barcode only when a trustworthy source provides an unambiguous mapping;
- otherwise leave `CardBarcode` blank;
- import a legacy photo only when the match is deterministic;
- otherwise leave official photo blank and collect it through the approved first-visit/renewal flow.

If the existing system can later export a deterministic member-to-card-barcode mapping, Super Admin may reconcile it in a controlled import. Otherwise the card is linked at reception on the member's next visit by identifying the member and scanning their existing physical card.

No mass reissue of cards is required merely because BGM changed software.

## Migration/Transition Import Safety

Normal import remains staged and non-destructive:

`Upload -> Parse -> Validate -> Match -> Preview -> Confirm -> Apply`

Before applying anything, Super Admin sees at least:

- total rows read
- existing members matched
- unchanged rows
- rows to update
- new legacy people
- safely linked card barcodes
- blank/unlinked card barcodes
- conflicts / ambiguous rows
- invalid rows
- deletions: always zero for normal import

Rows omitted from a workbook are never automatically deleted, archived or deactivated.

### Matching Rules

1. If `CardBarcode` is present, it can be used as a strong operational credential match only if it is already known to the same permanent member or can be safely linked from deterministic legacy evidence.
2. A barcode belonging/reserved to another member/application is a conflict and must never be moved automatically.
3. If `CardBarcode` is blank, use stored legacy linkage/context and supporting identifying data to find/reconcile the person; do not create a duplicate solely because there is no card link.
4. If matching remains ambiguous, mark `Conflict` / `Needs review` and make no destructive change.

## Pilot Rollout Strategy

The platform may initially operate at one gym while others continue using the old system.

During transition:

1. New pilot-gym members complete tablet enrollment and receive an unused preprinted card scanned by reception.
2. Other gyms may continue creating/updating members in the old system.
3. Later old-system XLSX exports are reconciled conservatively into the BGM transition data.
4. Existing BGM members keep their internal UUID and existing linked card barcode.
5. New legacy rows without known card barcodes are imported with blank `CardBarcode` and linked later at reception.
6. Barcode uniqueness is enforced against the live database at card assignment/import-apply time.
7. Once every gym uses the new platform, XLSX/CSV import/export remains available as a controlled bulk-data/backup facility.

The previous concern about concurrent generated-number sequences is removed because new BGM card numbers are not generated by software; they come from physical preprinted cards and are validated for uniqueness when scanned.

## Import Formats

Super Admin supports:

- controlled initial legacy XLSX/CSV using the approved 15-column source layout;
- ongoing BGM exchange XLSX/CSV using the revised 16-column layout with leading `CardBarcode`.

Formula cells must be flagged/handled safely rather than evaluated as arbitrary server code.

## Export Formats

Super Admin supports XLSX and CSV using the revised 16-column BGM exchange layout.

The export must preserve `CardBarcode` exactly as text, including leading zeroes, and leave the field blank when no card is linked.

## Field Preservation and Normalization

- Preserve source workbook values needed for faithful re-export/reconciliation.
- Normalize data internally for application use where appropriate.
- Gym spelling/casing variants may map to canonical BGM gym IDs for reporting.
- Dates are normalized internally while remaining exportable.
- Phone/mobile/postcode/email data must not be silently moved between fields based only on guesswork.
- Card barcode values are never numerically coerced; they remain text.

## NFC Future Compatibility

Existing NFC work may remain dormant.

If NFC is added later, an NFC credential can point to the same permanent member UUID alongside the barcode-card model. Adding NFC must not change member UUIDs or historical memberships.

## Audit Requirements

Audit at least:

- application submission and Staff Name
- card reservation/assignment
- wrong-card correction before activation
- membership activation and Activation Staff Name
- renewal
- card replacement/retirement
- bulk imports and conflict outcomes
- critical member identity/status changes

For card actions record the exact credential value in protected audit context where appropriate, the system user/gym, timestamp, affected member/application and action reason.

## Error Handling

- Reject duplicate/reserved card assignment immediately.
- Reject attempts to silently move an issued barcode between members.
- Preserve leading zeroes and exact scanned text.
- Do not fabricate a barcode for blank legacy rows or unlinked member-app accounts.
- Do not guess through ambiguous legacy matches.
- Do not delete omitted members.
- Failed activation must not produce a partially active card/member relationship.
- A replacement operation must retire the old card and activate the new card consistently.

## Testing Requirements

Implementation is test-first.

Minimum automated coverage:

- internal member UUID survives expiry, renewal and card replacement
- scanned preprinted barcode payload is preserved exactly
- leading zeroes are preserved
- duplicate/reserved barcode is rejected
- tablet application creates no fabricated BGM number
- new membership cannot activate without required card assignment
- Couples requires distinct card assignment for both members
- renewal keeps same member UUID and same card by default
- expired card still identifies member but does not grant access until renewal
- replacement retires old barcode and activates new barcode against same member
- retired barcode never grants a normal check-in
- member app virtual barcode equals exact currently active physical-card payload
- member app updates after card replacement
- member app shows no fabricated barcode if no card is linked
- exact revised 16-column `CardBarcode` XLSX/CSV contract
- initial 15-column legacy import path
- XLSX parsing of dates/text/blank fields
- CSV quoting/commas/newlines
- omitted rows cause zero deletions
- ambiguous legacy match stops for review
- export/import round trip preserves card barcode text
- barcode access grants active member and denies expired/inactive member
- barcode check-in uses the canonical check-in pipeline
- NFC remains dormant without breaking build/schema

Preview testing must include actual preprinted membership cards and at least one representative phone displaying the virtual barcode to verify reception reader compatibility before Production rollout.

## Deployment Safety

- Work only on `phase-2-operations-nfc-redesign`.
- Do not write directly to `main`.
- Schema changes are authored/tested as migrations in Development first.
- The existing development-only generated-number allocator must be retired through a reviewed migration; do not patch Production ad hoc.
- Normal import never deletes members.
- Production merge/migration occurs only after explicit Preview acceptance.
- The real membership workbook remains sensitive operational data and is never committed to the public repository.

## Success Criteria

The design is successful when:

1. Every person has one permanent internal member identity independent of a physical card.
2. New members receive the exact barcode from the preprinted card staff scans at reception.
3. Renewals keep the same member/card unless replacement is intentionally required.
4. Lost/damaged cards can be replaced without losing history, with the old barcode retired.
5. Existing members can migrate without fabricated numbers and can link current cards progressively.
6. The member app shows the exact currently active card barcode so a phone can substitute for a forgotten physical card.
7. Reception gives immediate photo-backed active/expired feedback and canonical check-in behavior.
8. XLSX/CSV transition remains conservative, non-destructive and preserves barcode values as text.
9. NFC can be added later without redesigning permanent member identity.