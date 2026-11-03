# Versioned Enrollment and Renewal Welcome Pack

## Intent

Every successful new enrollment and renewal should send the member a complete digital record of what was agreed at the time of the transaction, without letting email failure undo membership activation.

## Goals

- Send for both `new` and `renewal` membership applications after successful activation.
- Use the application `declaration_snapshot` as the primary legal source of truth so the email matches what the member accepted and what Staff printed.
- Fall back to currently published Super Admin declaration versions only when an older application is missing part of its snapshot.
- Include Gym Rules, Health Declaration, Privacy/GDPR declaration, Guardian Consent where applicable, and the completed membership form PDF.
- Record the exact declaration versions actually sent in the existing welcome-email audit entry.
- Keep delivery best-effort: any email/PDF failure is logged but never rolls back or blocks membership activation.

## Non-goals

- Do not change declaration wording or Super Admin publishing behaviour.
- Do not change membership pricing, activation, card, scanner, wallet, or print approval behaviour.
- Do not create a second mail system.
- Do not add a database table solely for version history because the immutable application snapshot and audit log already provide the required record.

## Approaches considered

### 1. Send whatever declarations are currently published at email time
Simple, but unsafe: wording could change between submission and activation and the emailed pack would no longer match what the member accepted.

### 2. Use only the application snapshot
Legally strong for current applications, but older records may have incomplete snapshots and would miss required documents.

### 3. Snapshot-first with published fallback — selected
Use `declaration_snapshot` whenever present, then resolve only missing required declarations from the current published Super Admin versions. Record the versions actually sent in the audit entry. This preserves historical correctness while keeping older records usable.

## Membership form PDF

The existing Staff form is rendered in the browser from `PrintableApplication` data and printed with `window.print()`. Email delivery runs server-side, so it cannot safely depend on a browser print dialog. The welcome pack will therefore build an A4 PDF server-side from the same printable application data and declaration snapshot. The PDF must contain the same material membership details and declarations as the Staff print form; the browser print UI remains unchanged.

## Delivery flow

1. Membership activation succeeds.
2. Existing post-activation best-effort hook identifies the activated application.
3. Load application, participants, membership/member numbers and printable application data.
4. Resolve declarations snapshot-first, with published fallback for missing required declarations.
5. Generate the completed membership-form PDF.
6. Send the email with inline declaration text plus PDF attachments for each applicable declaration and the completed membership form.
7. Insert/update the existing `membership.welcome_email.sent` audit record with recipient, member number, application kind, declaration versions sent, and sent timestamp.
8. If any mail/PDF step fails, log it and keep activation successful.

## Applicability

- Gym Rules: always.
- Health Declaration: always.
- Privacy/GDPR declaration: always.
- Guardian Consent: only for the participant(s) to whom guardian consent applies according to the application snapshot/policy.
- Membership form PDF: always, one completed participant form per recipient.

## Safety and compatibility

- Existing recent-activation guard remains to prevent historical bulk emails.
- Existing per-recipient audit deduplication remains.
- New enrollments and renewals both qualify.
- No Production changes or merge until the branch passes the full CI suite and is explicitly approved.