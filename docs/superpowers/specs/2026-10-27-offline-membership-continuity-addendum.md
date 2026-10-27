# BestGymsMalta Offline Membership Continuity — Addendum

Date: 2026-10-27
Status: Approved for implementation
Builds on: `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md`

## Purpose

An internet outage must not stop reception from selling a new membership. Staff must be able to complete a new membership locally, take payment, issue a physical BGM card immediately, and allow the member to train. When connectivity returns, the system must synchronize safely to the central database, allocate the permanent BGM number centrally, and send the same normal welcome package used by online activations.

The public `/join/<gymSlug>` tablet remains online-only. If connectivity is lost, the customer must immediately see a clear blocking offline message telling them to ask reception staff to enroll them instead of attempting to continue the public form.

## Locked business rules

- Offline enrollment exists only in the authenticated Staff Portal new-membership flow.
- Public/customer `/join/*` remains online-only and displays an immediate blocking offline state directing the customer to reception.
- A staff terminal may use offline enrollment only after it has previously loaded a valid enrollment configuration while online for that same gym/account.
- Staff may complete the normal new-member details offline, record required verification confirmations, take payment, and issue physical card(s) immediately.
- The member may train immediately once staff confirms the offline sale has been saved locally.
- The physical card is a provisional offline assignment until central sync confirms it. A card conflict at sync preserves the sale/application and routes it to review; it never silently discards the member.
- No permanent BGM member number is generated, guessed, reserved, or displayed offline.
- The commercial membership start date is the original offline sale date in `Europe/Malta`, not the later synchronization date.
- The price and declaration versions used offline are the immutable versions cached while online. Later price/rules changes do not silently alter the queued sale.
- Discount/voucher use remains online-only because validity/usage cannot be safely confirmed during an outage.
- Each offline sale gets a random `clientSubmissionId` plus a visible operational reference `OFFLINE-<short-id>`.
- Local records include the registration draft, optional photo blobs, price/declaration snapshots, payment method, staff name, physical card value(s), verification confirmations, gym, and original sale timestamp.
- Local PII remains queued until the central server returns a persisted idempotent receipt; then the local copy is deleted.
- Synchronization is automatic when connectivity returns and a valid Staff session is available. If login has expired, the record is retained and staff is told to log in; nothing is dropped.
- Server sync reruns identity/card/config checks. Clean new memberships auto-activate centrally. Active identity, possible renewal, card conflict, stale config, or incomplete verification becomes a review-required server application.
- Permanent BGM number allocation remains exclusively in the existing central activation transaction.
- Successful activation from an offline sale sends the same welcome package as an online activation only after permanent BGM number assignment.
- Welcome delivery is best-effort and idempotent. Email failure never rolls back an activated membership. The system records success so retries cannot send duplicates, and failed delivery remains eligible for retry/manual resend.
- The welcome email must include the newly assigned permanent BGM number together with the normal member-app instructions and Gym Rules package. Online and offline activations use the same email builder/path so they do not diverge.

## Tablet offline copy

When `/join/<gymSlug>` detects loss of connectivity, hide/block the registration form and show prominently:

**SYSTEM OFFLINE**

**Membership registration is temporarily unavailable on this tablet. Please speak to our staff at the front desk and they will enroll you.**

When connectivity returns, the tablet may reload/revalidate its configuration and restore the normal form.

## Staff offline completion copy

After staff records the member, payment and card locally, show:

**Membership saved offline — member may train immediately.**

Also show:

- temporary `OFFLINE-...` reference;
- `PENDING ONLINE ACTIVATION`;
- physical card number(s) with `PENDING CONFIRMATION`;
- payment amount/method;
- original sale date/time;
- `No permanent BGM member number has been issued yet.`

## Production safety

- Implement and verify on the existing Vercel-suppressed `feature/tablet-enrollment-membership-settings` branch.
- TEST Supabase only during implementation: `vlvyqdjhzdcxatilbdiv`.
- Production Supabase `jsuolemirhivqhjbjetv` remains untouched until explicit approval.
- Do not touch Punch Clock/biometric code as part of this work.
- No Preview deployment is required during development unless explicitly approved after tests are green.
