# Tablet Enrollment, Membership Settings & Offline Continuity — Plan Index

Date: 2026-09-16
Status: Ready for implementation after user approval

Read these documents in this order:

1. `docs/superpowers/specs/2026-09-16-tablet-enrollment-pwa-membership-settings-design.md` — approved product/architecture specification.
2. `docs/superpowers/plans/2026-09-16-tablet-enrollment-01-membership-settings-versioning.md` — deployment guard, Super Admin pricing, discount codes, Gym Rules/declaration versioning.
3. `docs/superpowers/plans/2026-09-16-tablet-enrollment-02-shared-registration-tablet.md` — shared registration domain/form, `/join/<gym-slug>` tablet PWA, public submission and duplicate classification.
4. `docs/superpowers/plans/2026-09-16-tablet-enrollment-03-staff-review-activation-print-photo.md` — reception review, possible-renewal conversion, verification gates, card/payment activation, one-page A4 printing and deferred photo workflow.
5. `docs/superpowers/plans/2026-09-16-tablet-enrollment-04-offline-continuity-rollout.md` — staff offline queue/sync, idempotency, local/private testing, browser coverage and release-candidate verification.
6. `docs/superpowers/plans/2026-09-16-tablet-enrollment-self-review-amendments.md` — required corrections found during final spec-to-plan coverage review, including participant-specific Couples acknowledgements, camera recovery, audit coverage, offline renewal and pending offline discount validation.
7. `docs/superpowers/plans/2026-09-16-tablet-enrollment-plan-hardening-addendum.md` — canonical shared types, enrollment-branch CI trigger, safe public rate limits, race-safe declaration versions and crash/concurrency-safe offline idempotency.

If an amendment conflicts with wording in Plans 01–04, the later self-review/hardening document wins for that specific topic.

## Sequence and branch safety

The plans are intentionally sequential. Plan 02 consumes the published settings interfaces from Plan 01; Plan 03 consumes the application/snapshot interfaces from Plan 02; Plan 04 adds offline capture/sync only after the online workflow is stable.

Implementation branch: `feature/tablet-enrollment-membership-settings`, stacked from the latest approved `feature/staff-dashboard-reception` head. Because PR #9 is still draft and unmerged, the enrollment branch must retain that dependency rather than pretending to branch from `main`.

Before that implementation branch is created, update `vercel.json` on the already Vercel-suppressed `feature/staff-dashboard-reception` branch so both branch names have `deploymentEnabled: false`. Only after that config commit is confirmed should the new branch be created. This ordering prevents an accidental Preview deployment.

No Production merge/deploy is allowed without explicit user approval. Normal development uses local execution and GitHub CI. For real tablet/camera/PWA testing, expose the local Next.js server through a temporary HTTPS Cloudflare Quick Tunnel. Create at most one deliberate Vercel Preview at a meaningful release-candidate checkpoint, and only if Vercel storage allows it.

## Locked implementation boundaries

- Public `/join/<gym-slug>` is New Member only and online-only.
- Staff retains New Membership and Renewal, including offline renewal from a known permanent card/member number.
- Barcode/physical card only; no NFC implementation.
- Permanent BGM membership numbers are server-generated only and never allocated offline.
- Tablet requires a live photo; Staff may capture, upload, retain or choose Photo Later.
- `PHOTO REQUIRED` warns on each scan but does not by itself deny an otherwise valid check-in.
- Prices and declaration versions are server-authoritative; submitted applications keep immutable snapshots.
- Discount usage increments only inside successful Payment Received / activation. An offline code may be queued only as pending online validation.
- Couples are one transaction with two participant/member/card outcomes and atomic activation; declaration acceptance is recorded per participant.
- One printed A4 page per member; Couples therefore print exactly two member pages.
- Initial Gym Rules/declaration wording must be seeded verbatim from the user-provided `Generic Membership form.pdf`; do not invent legal copy.
- Public enrollment cannot launch until Gym Rules, privacy/data-processing and health declaration versions are all published.
- All server calendar-day rules use `Europe/Malta` semantics.

## Verification baseline

Every plan finishes its own targeted tests. Final verification runs the repository baseline used by Phase 2 CI:

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
node tests/browser/member-card-gyms.mjs
node tests/browser/staff-dashboard.mjs
node tests/browser/tablet-enrollment.mjs
```

The new browser script `tests/browser/tablet-enrollment.mjs` is introduced in Plan 02 and expanded through Plans 03–04. No test should be weakened to make a failing implementation pass.