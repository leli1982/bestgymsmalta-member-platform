# Tablet Enrollment Plan — Type, CI, Rate-Limit & Idempotency Hardening

Date: 2026-09-16
Status: Required implementation-plan hardening

This addendum follows the main self-review amendments and wins for the topics below.

## 1. Canonical shared TypeScript interfaces

**Applies to:** Plan 01 Task 3, Plan 02 Task 2, Plan 04 Tasks 2–5.

Create `lib/membershipRegistrationTypes.ts` in Plan 02 and move/re-export shared enrollment types there. Later plans must import these exact names rather than redefining lookalikes.

```ts
import type {
  MembershipDurationKey,
  MembershipType,
} from "@/lib/membershipSettingsCore";

export type PriceEntry = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  amountCents: number;
  currency: "EUR";
};

export type PublishedDeclarationSnapshot = {
  id: string;
  contentKey: "gym_rules" | "privacy" | "health" | "guardian";
  versionNo: number;
  body: string;
  contentSha256: string;
};

export type PublicEnrollmentConfig = {
  gym: { id: string; name: string; shortName: string; slug: string };
  pricing: { versionId: string; entries: PriceEntry[] };
  declarations: {
    gymRules: PublishedDeclarationSnapshot;
    privacy: PublishedDeclarationSnapshot;
    health: PublishedDeclarationSnapshot;
    guardian?: PublishedDeclarationSnapshot;
  };
};

export type GuardianDetails = {
  fullName: string;
  idNumber: string;
  relationship: string;
  mobile: string;
  email: string;
  address: string;
};

export type RegistrationParticipant = {
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  nextOfKin: string;
  guardian?: GuardianDetails;
};

export type ParticipantDeclarationAcceptance = {
  gymRules: boolean;
  privacy: boolean;
  health: boolean;
};

export type RegistrationDraft = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  documentReadinessAcknowledged: boolean;
  participants: RegistrationParticipant[];
  declarations: ParticipantDeclarationAcceptance[];
  photos: Array<File | null>;
};

export type OfflineVerificationSnapshot = {
  participantIdVerified: boolean[];
  studentEligibilityVerified: boolean[];
  sameAddressVerified: boolean;
  guardianPresentVerified: boolean[];
  guardianCosignVerified: boolean[];
};
```

`photos` is in-memory/browser-side only; never JSON stringify it. Offline storage separates Blob photos from serialized fields as described in Plan 04.

Add `tests/membership-registration-types-contract.test.mjs` to pin these exports.

## 2. CI must run automatically on the enrollment feature branch

**Applies to:** Plan 01 Task 1 and Plan 02 Task 7.

Current `.github/workflows/phase2-ci.yml` push triggers do not include the new enrollment branch. During branch-safety setup, add:

```yaml
on:
  push:
    branches:
      - phase-2-operations-nfc-redesign
      - feature/tablet-enrollment-membership-settings
      - main
```

Keep the existing `pull_request: branches: [main]` behavior. This changes GitHub CI only; it does not re-enable Vercel deployment.

Extend `tests/vercel-deployment-guard.test.mjs` or add `tests/phase2-ci-branch-contract.test.mjs` to assert the workflow contains the feature branch string.

## 3. Public rate limit must not throttle a busy shared gym/NAT

**Applies to:** Plan 02 Tasks 3–4.

Replace the illustrative `10 submissions/hour` limit. The gym tablet and customers on gym Wi-Fi can legitimately share one public IP.

Use these initial server constants:

```ts
export const PUBLIC_IDENTITY_CHECKS_PER_HOUR = 600;
export const PUBLIC_SUBMISSIONS_PER_HOUR = 120;
```

Buckets are per hashed-IP + gym + action. Submission still requires valid gym, valid published config, strict payload/photo sizes and exact identity validation. If operational data later shows abuse, limits can be tuned without changing membership business logic.

Tests must prove 120 submissions are allowed and the 121st bucket claim is rejected for the same fingerprint/hour, while a different gym or next bucket is independent.

Do not use a low rate that could block legitimate reception/tablet enrollment.

## 4. Declaration version numbering must be race-safe

**Applies to:** Plan 01 Tasks 2 and 4.

Do not calculate `max(version_no) + 1` in browser/API code without a lock. Add service-role RPC:

```sql
public.bgm_create_membership_declaration_draft(
  p_content_key text,
  p_body text,
  p_content_sha256 text,
  p_system_user_id uuid
) returns uuid
```

Inside the function, take a transaction advisory lock derived from `p_content_key`, compute the next version, insert the draft and audit it. The API calls this RPC. A concurrent two-request test/SQL verification must show unique sequential versions with no duplicate-key race.

Price catalog version uses its database-generated identity and does not accept caller-provided version numbers.

## 5. Offline sync idempotency must survive concurrent retries and mid-sync crashes

**Applies to:** Plan 04 Tasks 1 and 5.

A final receipt lookup alone is not sufficient because two identical requests can race before either writes the receipt. Add to `bgm_membership_applications`:

```sql
offline_client_submission_id uuid unique
```

For offline sync, the server creates/loads the central pending application using this UUID before any permanent-member activation. Exact algorithm:

1. authenticate and validate gym;
2. look for final `bgm_offline_membership_sync_receipts.client_submission_id`;
3. if final receipt exists, return it;
4. attempt to create the central application with `offline_client_submission_id = clientSubmissionId`;
5. on unique conflict, fetch that exact application and resume it rather than create another;
6. upload any photo that is still missing using the existing application participant IDs;
7. rerun central validations;
8. activate only if safe;
9. insert/upsert one final receipt;
10. return the final receipt.

The application itself is therefore the durable in-progress idempotency anchor. A crash after Step 4 can be resumed safely. A second concurrent request converges on the same application.

The activation RPC must be idempotent for an already-activated application: return the existing activation/member result rather than allocate new permanent numbers/cards or consume a discount again.

Add tests for:

- two concurrent requests with the same `clientSubmissionId` -> one application;
- retry after application persisted but before activation -> resumes same application;
- retry after activation -> same member number(s), discount count unchanged;
- retry after `review_required` -> same review application.

## 6. Exact local HTTPS test command

**Applies to:** Plans 02–04 local tablet testing.

Run Next.js locally:

```bash
npm run dev
```

In a second terminal, if `cloudflared` is installed:

```bash
cloudflared tunnel --url http://localhost:3000
```

Use the generated temporary `https://*.trycloudflare.com` URL on the tablet and append `/join/birkirkara`. This is temporary testing only; no Cloudflare account/tunnel persistence is required. Stop `cloudflared` immediately after the session.

If `cloudflared` is not installed, install/use an equivalent local HTTPS tunnel only after the user approves that setup; do not substitute a Vercel deployment merely to test camera/PWA behavior.

## 7. Self-review completion check

Before starting implementation, the executor reads, in order:

1. approved spec;
2. plan index;
3. Plans 01–04;
4. `2026-09-16-tablet-enrollment-self-review-amendments.md`;
5. this hardening addendum.

There are no `TBD`/`TODO` implementation requirements in this plan series. If repo inspection during implementation contradicts an exact path/schema assumption, stop at that task and use systematic debugging/design escalation rather than silently changing the business rule.