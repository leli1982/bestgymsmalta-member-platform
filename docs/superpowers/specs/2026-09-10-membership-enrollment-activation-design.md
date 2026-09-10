# Membership Enrollment & Activation — Approved Design

## Status

Approved on 2026-09-10 for Phase 2 branch `phase-2-operations-nfc-redesign`.

This supplements the Phase 2, migration/barcode, Gym Staff and official-photo designs. It uses the application-first, atomic-activation model for both new memberships and renewals, with physical preprinted-card scanning as the source of the operational membership/card number.

## Core Rule

Printing or submitting a membership application never activates a membership.

The only membership activation action is:

`PAYMENT RECEIVED — ACTIVATE`

The permanent person identity is the internal member UUID. The visible operational membership/card number is the exact barcode value scanned from the physical preprinted membership card.

The system does not generate a new `BGMxxxxxxx` membership number for new enrollments.

## Mandatory Staff Accountability

`Staff Name` is mandatory for both NEW MEMBERSHIP and RENEWAL.

There are two separately recorded human-attribution points:

1. **Application Staff Name** — the staff member who prepared/submitted the membership or renewal application.
2. **Activation Staff Name** — the staff member who confirmed payment and pressed `PAYMENT RECEIVED — ACTIVATE`.

Both values are required server-side. The database/audit trail records both the authenticated shared gym account and the entered Staff Name.

Standalone `Issue New Card` also requires Staff Name because it permanently retires one access credential and issues another.

## NEW MEMBERSHIP

### Tablet application

1. Staff/member chooses `NEW MEMBERSHIP`.
2. Select membership type: Single, Couples or Student.
3. Select duration: 1 week, 2 weeks, 1 month, 3 months, 6 months or 1 year.
4. Enter start date, expiry date and participant details.
5. Capture mandatory official photo for each participant.
6. Review the application.
7. Enter required Application Staff Name.
8. Submit the application. It remains pending/awaiting payment.
9. Staff may print the completed application. Printing has no activation side effects.

The tablet does not assign or invent a membership/card number.

### Main staff/reception screen

After submission, the gym's main staff screen receives a prominent pending action such as:

`NEW MEMBERSHIP READY — SCAN CARD`

Opening it shows the applicant name and official photo.

Staff scans an unused preprinted physical membership card. The exact decoded barcode payload is validated and reserved to that applicant. For Couples, each participant receives a separate card scan clearly paired with their own name/photo.

An unused card accidentally scanned before activation may be corrected/rescanned. An already active/reserved/retired barcode must be rejected according to the credential-lifecycle rules.

### Activation

Once the required photo(s) and physical-card assignment(s) are complete, staff enters required Activation Staff Name and presses:

`PAYMENT RECEIVED — ACTIVATE`

One database transaction must:

- create the permanent member UUID/person record for each genuinely new participant;
- create the membership period and links;
- attach the approved official photo to the permanent member identity;
- promote the reserved scanned card barcode to the member's active credential;
- update compatibility status/expiry fields as needed;
- mark the application activated;
- write audit attribution.

If activation fails, no partially active member/card relationship may remain.

For Couples, both participants are separate permanent people with separate photos and separate scanned card barcodes while sharing the membership contract.

## RENEWAL

Renewal always reuses the existing permanent member UUID and always requires a physical-card scan before activation.

1. Staff chooses `RENEWAL`.
2. Find/identify the existing member by current physical barcode, virtual app barcode, or fallback search by name/mobile/email/legacy reference.
3. Explicitly confirm the correct existing member and show official photo/current card/current expiry.
4. Select the new membership type/duration/start/expiry.
5. Capture an official photo if one is missing or intentionally being replaced.
6. Enter required Application Staff Name and submit the renewal application.
7. On the main staff/reception screen, scan a physical card as the mandatory renewal card-verification step.
8. If the scanned card equals the current active card, mark the renewal as **same card** and preserve that barcode.
9. If the scanned card is a different unused card, show **NEW CARD ON RENEWAL**, old -> new barcode, and require explicit confirmation. The old card remains unchanged until successful activation.
10. At payment, enter required Activation Staff Name and press `PAYMENT RECEIVED — ACTIVATE`.
11. The activation transaction creates the new membership period against the same permanent member UUID. For same-card renewal it keeps the current credential. For confirmed replacement renewal it atomically retires the old card permanently and activates the new scanned card.

An expired membership does not itself retire the card. The known card can still identify the member while access is denied. After renewal, the same re-scanned card works again unless a replacement card was explicitly confirmed.

If a replacement renewal fails or is cancelled, the old card must remain the member's existing credential and the proposed new card must not leave the member locked out.

Mixed Couples cases involving one existing member plus a brand-new partner remain outside this specific flow unless separately designed.

## Standalone `Issue New Card`

Gym Staff has a dedicated `Issue New Card` action for lost, stolen or damaged cards.

This does not renew or extend membership.

1. Find and verify the existing member.
2. Show official photo/current card/status/expiry.
3. Enter required Staff Name.
4. Scan a new unused preprinted card.
5. Show old card -> new card and require explicit confirmation.
6. In one transaction, retire the old barcode permanently and activate the new barcode against the same permanent member UUID.
7. The member app virtual card uses the new active barcode from then on.

A failed replacement leaves the old credential unchanged.

## Member App Virtual Card

The authenticated member app displays the exact currently active physical-card barcode payload.

This virtual barcode is not a second credential. It is a digital rendering of the same active card value so a member can scan their phone at reception if they forget the physical card.

Rules:

- Source the active card from the authenticated server/member session.
- Do not derive a generated `BGMxxxxxxx` value.
- Same-card renewal leaves the app barcode unchanged.
- Replacement on renewal or standalone `Issue New Card` switches the app to the new active barcode.
- Retired barcodes no longer grant access.
- If no physical card is linked, show `CARD NOT LINKED — ASK RECEPTION` instead of inventing a barcode.

## Permissions

Underlying API authorization remains granular internally, but normal gym accounts receive one fixed Gym Staff bundle.

Required operational capabilities include:

- member lookup/view
- new membership application
- renewal application
- membership activation
- official photo view/capture in authorized flows
- barcode access scanning
- card assignment/replacement
- Sundries submit
- Bar List submit

Super Admin bypass remains server-side and includes complete management/history access.

## Gym Context

`enrollment_gym_id` records where the membership was sold/processed for reporting and audit purposes only. BGM membership remains network-wide.

## Database Direction

The current Development schema still includes the old generated-number allocator and current barcode lookup via `bgm_members.member_number`. A reviewed follow-up migration must replace that operational model safely rather than editing Production ad hoc.

Implementation direction:

- keep `bgm_members.id` as permanent person identity;
- introduce/normalize a physical card credential table with exact barcode value, lifecycle status, member/application linkage and audit fields;
- allow a reserved credential to belong to a pending application participant before activation;
- enforce uniqueness so one usable card cannot be assigned to multiple people/applications;
- permanently retain retired/replaced card history;
- remove the requirement/default that generates `BGMxxxxxxx` numbers for newly activated members;
- update activation transaction to require reserved card assignment(s) for new memberships;
- update renewal transaction to require an explicit scanned card decision (`same` or `replacement`);
- make replacement retirement/activation atomic;
- retain compatibility mirrors only where necessary during the transition.

## Search Safety

Member search returns only operational fields needed to confirm identity and prepare renewal: member UUID, current card barcode when authorized, name, status, expiry, mobile/email/legacy reference and official photo representation when authorized.

Legacy `pkCustomer` is never treated as globally unique. Search by legacy PK may return multiple candidates.

## Audit

Meaningful events record authenticated gym/system account and human Staff Name where required, including:

- new membership application submitted;
- renewal application submitted;
- new-card reservation;
- renewal same-card verification;
- renewal replacement-card confirmation;
- membership activated/payment received;
- standalone card replacement;
- old-card retirement;
- affected member/application/membership/card IDs.

## Launch Access

NFC is not part of the launch enrollment workflow. Reception access and the member app use the active preprinted-card barcode credential.

The member app renders that exact payload as a scannable virtual barcode, subject to hardware Preview testing with the real reception scanners.

## Testing Requirements

Implementation is test-first and must cover at least:

- new tablet application has no fabricated/generated BGM number;
- new activation cannot succeed without required photo and physical-card assignment;
- exact scanned barcode payload is preserved including leading zeroes;
- duplicate/reserved/retired conflicting card assignment is rejected;
- Couples require separate card assignment per participant;
- every renewal requires a physical-card scan;
- same-card renewal keeps the same credential;
- different-card renewal retires the old credential only on successful activation;
- failed/cancelled replacement renewal leaves the old credential intact;
- standalone `Issue New Card` changes only card credential, not membership dates;
- retired card never grants access;
- virtual member-app barcode equals the exact currently active physical-card payload;
- app updates to new barcode after replacement;
- unlinked member receives no fabricated virtual barcode;
- member UUID/history/photo survive renewals and card replacements.
