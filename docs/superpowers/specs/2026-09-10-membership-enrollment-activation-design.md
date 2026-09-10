# Membership Enrollment & Activation — Approved Design

## Status

Approved on 2026-09-10 for Phase 2 branch `phase-2-operations-nfc-redesign`.

This supplements the existing Phase 2 and membership/barcode designs. It chooses the application-first, atomic-activation model for both new memberships and renewals.

## Core Rule

Printing or submitting a membership application never activates a membership and never consumes a permanent BGM membership number.

The only activation action is:

`PAYMENT RECEIVED — ACTIVATE`

For a genuinely new member, the permanent person record and BGM membership number are created only inside the successful activation transaction. For a renewal, the existing person identity and permanent membership number are reused.

## Mandatory Staff Accountability

`Staff Name` is mandatory for both NEW MEMBERSHIP and RENEWAL.

There are two separately recorded human-attribution points:

1. **Application Staff Name** — the staff member who prepared/submitted the membership or renewal application.
2. **Activation Staff Name** — the staff member who confirmed payment and pressed `PAYMENT RECEIVED — ACTIVATE`.

Both values are required server-side, not only in the browser UI. This allows management to identify the responsible staff member when investigating membership problems even though each gym uses a shared system login.

The database/audit trail records both the authenticated system/gym account and the entered Staff Name.

## NEW MEMBERSHIP

1. Staff chooses `NEW MEMBERSHIP`.
2. Select membership type: Single, Couples or Student.
3. Select duration: 1 week, 2 weeks, 1 month, 3 months, 6 months or 1 year.
4. Enter membership start date and participant details.
5. Enter required Application Staff Name.
6. Submit the application. It remains pending/awaiting payment.
7. Staff may print the completed application. Printing has no activation side effects.
8. At payment, enter required Activation Staff Name and press `PAYMENT RECEIVED — ACTIVATE`.
9. One database transaction creates the permanent person identity/identities without client-generated member numbers, creates the membership period, links participants, updates compatibility status/expiry fields, marks the application activated and writes audit attribution.
10. The database allocator supplies each new person's permanent BGM number. Once committed, it is permanent and is never recycled.

For Couples, both participants are separate permanent people with separate BGM numbers/barcodes but share the membership contract.

## RENEWAL

1. Staff chooses `RENEWAL`.
2. Search the existing BGM database before entering membership-period details.
3. Exact permanent Membership Number/barcode is the strongest search. Fallback search may use name, mobile, email or legacy PK.
4. Multiple/ambiguous fallback results are shown for explicit staff selection; the system never guesses.
5. After selection, show the member's permanent number prominently with: `This number and barcode stay with this member.`
6. Select the new membership type/duration/start date.
7. Enter required Application Staff Name and submit the renewal application.
8. Printing has no activation side effects.
9. At payment, enter required Activation Staff Name and press `PAYMENT RECEIVED — ACTIVATE`.
10. The activation transaction creates a new membership-period record linked to the same permanent member identity, updates compatibility status/expiry and marks the application activated. It never creates a replacement person or allocates a new BGM number.

For this implementation, a renewal application only reuses explicitly confirmed existing identities. Mixed couples cases involving an existing member plus a brand-new partner are not silently inferred and are outside this bounded task.

## Permissions

- Search: `members.view`
- New application: `members.create`
- Renewal application: `members.renew`
- Payment activation: `membership.activate`
- Super Admin bypass remains server-side.

## Gym Context

`enrollment_gym_id` records where the membership was sold/processed for reporting and audit purposes only. BGM membership remains network-wide and is not restricted to that gym.

## Database Direction

Create a follow-up migration because the Phase 2 foundation migration is already applied in Development.

Add:

- `bgm_membership_applications.application_kind` constrained to `new | renewal`.
- `bgm_membership_application_members.existing_member_id` nullable FK to `bgm_members`.
- A transactional activation function that validates application state, mandatory Activation Staff Name and participant identity rules before committing membership changes.

The transaction must fail as a unit on any validation/database failure.

## Search Safety

Member search returns only the operational fields required to confirm identity and prepare renewal: member ID, permanent membership number, name, status, expiry, mobile/email/legacy reference and official photo reference when authorized.

Legacy `pkCustomer` is never treated as a globally unique identity. Search by legacy PK may return multiple candidates.

## Audit

Meaningful events must record system account/gym context and Staff Name, including:

- membership application submitted;
- renewal application submitted;
- membership activated/payment received;
- affected member IDs and membership/application IDs where available.

## Launch Access

No NFC assignment is part of this workflow. Permanent Code 128 member barcode remains the launch credential.
