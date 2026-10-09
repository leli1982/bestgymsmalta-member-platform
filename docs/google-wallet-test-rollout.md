# C4 Google Wallet — TEST Rollout & Verification

This runbook is for the **BestGymsMalta TEST environment only**. It does not authorize or describe applying C4 to Production. Production Supabase, Production Google Wallet configuration, Production deployment, real-member issuance, and PR merge remain separate owner-approval gates.

## 1. Safety boundaries

- Use TEST Supabase only: `vlvyqdjhzdcxatilbdiv`.
- Do not apply C4 migrations to Production Supabase `jsuolemirhivqhjbjetv` during this runbook.
- Use a dedicated TEST Google Wallet namespace:
  - class suffix: `bgm_membership_test_v1`
  - object prefix: `test_`
- Use only a fictional TEST member for issuance tests.
- Never paste or commit a Google service-account private key, JSON key file, OAuth token, Vercel token, or other secret into the repository, issue, pull request, build log, screenshot, or chat.
- Enter the Google private key directly into Vercel as a protected Preview environment secret.
- Do not manually invoke the Production daily cron.
- C1 expiry/grace and C3 member notifications remain authoritative for their existing behavior. C4 does not add Google expiry/upcoming notifications.

## 2. Google Wallet TEST issuer prerequisites

Google Wallet REST issuance requires a Google Wallet API Issuer account plus a Google Cloud service account authorized for that issuer.

For TEST:

1. Sign in to the Google Pay & Wallet console and create/confirm the issuer account.
2. Remaining in demo mode is acceptable for TEST. Demo passes may show `[TEST ONLY]`, and issuance is limited to issuer Admin/Developer users or explicitly added test accounts.
3. In the chosen Google Cloud project, enable the **Google Wallet API**.
4. Create a dedicated service account for the BGM TEST integration.
5. Create a JSON key for that service account and store it securely outside the repository.
6. In Google Pay & Wallet Console → **Users**, invite the service-account email with **Developer** access.
7. Add the Google account used for the physical TEST phone as an allowed test account if it is not already an Admin/Developer user.
8. Record the numeric Wallet issuer ID. The issuer ID itself is configuration, not the private key.

The service-account key is server-side only. C4 uses it for Google Wallet REST authentication and signed Add-to-Google-Wallet URLs.

## 3. Vercel Preview environment variables

Configure the following variables for the **Preview / TEST deployment only**. None is `NEXT_PUBLIC_*`.

| Variable | TEST value / rule |
| --- | --- |
| `GOOGLE_WALLET_ENABLED` | `true` |
| `GOOGLE_WALLET_ISSUER_ID` | Numeric TEST Wallet issuer ID |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | TEST service-account email |
| `GOOGLE_WALLET_PRIVATE_KEY` | Private key from the TEST JSON key; enter directly as a protected Vercel secret |
| `GOOGLE_WALLET_CLASS_SUFFIX` | `bgm_membership_test_v1` |
| `GOOGLE_WALLET_OBJECT_PREFIX` | `test_` |
| `GOOGLE_WALLET_ORIGIN` | Exact HTTPS origin used to open the TEST member app |
| `GOOGLE_WALLET_LOGO_URL` | Publicly reachable HTTPS BGM logo URL |
| `GOOGLE_WALLET_APP_URL` | HTTPS TEST member-card/app URL |

Configuration checks:

- `GOOGLE_WALLET_ISSUER_ID` contains digits only.
- Origin, logo, and app URL are HTTPS.
- The logo URL is fetchable without staff/member authentication or Vercel deployment protection blocking Google.
- `GOOGLE_WALLET_PRIVATE_KEY` is stored only as a server secret. Escaped `\n` newlines are supported by the server loader.
- Preview values are not copied into Production scope.
- Redeploy the C4 Preview after the variables are saved so the deployment receives them.

## 4. Database state before manual issuance

C4 schema must already be present on TEST:

- `bgm_google_wallet_passes`
- member-change pending trigger
- card-change pending trigger
- RLS enabled
- `anon` and `authenticated` have no direct table privileges
- `service_role` has only `SELECT`, `INSERT`, `UPDATE`, `DELETE`

Before the first Add-to-Wallet action for the fictional member, there should be **no mapping row** for that member. Merely being an eligible BGM member must never bulk-provision a Google Wallet object.

## 5. Fictional TEST member setup

Use one clearly fictional TEST member with:

- active membership
- expiry today or later in Malta time
- no effective cancellation today
- not archived
- one current active physical-card credential
- member-app activation/login available

Record for verification only:

- immutable TEST member UUID
- BGM display number
- current physical-card barcode
- membership expiry

The BGM display number and physical-card barcode must be different test values so barcode-source mistakes are obvious.

## 6. Manual TEST verification sequence

### A. First Add / save

1. Sign in as the fictional member on the C4 Preview.
2. Open the full membership card.
3. Confirm the official **Add to Google Wallet** button appears. The compact home card must not show it.
4. Tap once and complete the Google save flow on the allowed TEST Google account.
5. Verify one `bgm_google_wallet_passes` row now exists for the member and becomes `synced`.
6. Verify the object ID is deterministic: `<issuerId>.test_member_<member-uuid>`.
7. In Google Wallet confirm:
   - BestGymsMalta branding
   - member full name
   - BGM member number shown only as display information
   - membership status
   - expiry shown `DD/MM/YYYY`
   - active barcode type is `CODE_128`
   - barcode value equals the **current physical-card credential**, never the BGM member number
   - no member photo is present
   - no Google expiry/upcoming notification configuration is present

### B. Repeat Add is idempotent

1. Return to the member card and use Add to Google Wallet again.
2. Confirm BGM reuses the same deterministic Google object and the same mapping row.
3. Confirm no duplicate object or mapping is created.

### C. Physical-card replacement

1. Replace the member's physical card through the normal BGM staff workflow.
2. Confirm BGM replacement succeeds independently of Google.
3. Confirm the old physical credential is immediately invalid in BGM.
4. Confirm the existing Wallet object is updated to the new physical-card barcode; it must not become a second Wallet object.
5. If Google is deliberately unavailable for this test, confirm the BGM card replacement still succeeds and the mapping stays recoverable as `pending`/`failed`.

### D. Renewal

1. Renew through the canonical BGM membership workflow.
2. Confirm the same Wallet object remains in use.
3. Confirm Wallet returns/stays `ACTIVE`, keeps the current physical-card barcode, and reflects the new expiry.
4. Confirm expiry validity lasts through the complete Malta expiry date and ends at the following Malta midnight.

### E. Scheduled cancellation

1. Schedule a future cancellation date on the fictional member.
2. Confirm the Wallet object remains active before that date.
3. Confirm its validity end is the **start of the cancellation-effective Malta date**, or the post-expiry Malta midnight if that occurs earlier.
4. No future cron write should be necessary for the pass to reach its precomputed end time.

### F. Non-access states

Test each state independently, restoring the fictional member between cases when required:

- effective cancellation
- archive
- inactive membership
- expired membership / C1 grace
- no active physical card

For each case, confirm the same Wallet object is updated to an inactive/expired non-access presentation with **no prior scannable physical credential left as current**. C1's seven-day app grace does not extend Wallet/gym access.

### G. Recovery engine

1. With an already-provisioned fictional pass, create a legitimate TEST-only `pending` or `failed` mapping state by changing a watched BGM member/card field while Google sync is unavailable, or by using an equivalent controlled TEST failure.
2. Restore Google connectivity/configuration.
3. Verify recovery processes only existing `pending`/`failed` mappings, oldest first.
4. Verify it uses `provision:false`, creates no mapping for any unrelated member, and reuses the same object ID.
5. Default recovery is bounded to 25 rows; implementation clamps explicit page size to 1–50.
6. Verify one failed member does not stop later selected members.
7. Do not invoke the Production cron. A TEST-only authorized request may be used only against the TEST Preview/environment if needed.

## 7. Automated verification gate

The branch is not ready for the Production approval gate until the final C4 head passes all of the following in Phase 2 CI:

```text
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
node tests/browser/membership-print-a4.mjs
node tests/browser/member-card-gyms.mjs
node tests/browser/member-engagement-notifications.mjs
node tests/browser/super-admin-member-editor.mjs
node tests/browser/super-admin-couples-member-editor.mjs
node tests/browser/staff-dashboard.mjs
node tests/browser/staff-global-scanner.mjs
node tests/browser/bar-sales.mjs
node tests/browser/operations-dashboard.mjs
node tests/browser/super-admin-announcements.mjs
node tests/browser/member-data.mjs
node tests/browser/super-admin-management.mjs
node tests/browser/shopping-list.mjs
node tests/browser/reception-photo-warning.mjs
node tests/browser/staff-enrollment-gym.mjs
node tests/browser/staff-minor-renewal.mjs
node tests/browser/tablet-enrollment.mjs
```

CI uses mocks and an ephemeral RSA key. Real Google credentials must never be added to GitHub Actions for this verification.

## 8. TEST security review

After manual TEST issuance/recovery:

- Re-run TEST Supabase security/performance advisors.
- Verify `bgm_google_wallet_passes` still has RLS enabled.
- Verify no `anon`/`authenticated` direct privileges were introduced.
- Verify `service_role` retains only CRUD required by the Next.js server.
- Confirm no new Wallet row appeared for members who did not request Wallet.
- Confirm no private key, OAuth token, raw provider response, or member-sensitive ID was exposed to browser code/API responses/logs.

## 9. Evidence to retain for the Production approval gate

Record only non-secret evidence:

- final C4 branch commit SHA
- successful Phase 2 CI run ID
- Vercel Preview deployment ID/status
- TEST migration versions present
- TEST mapping count before and after fictional issuance
- fictional member UUID/member number/card values used for the scenario
- one stable TEST object ID across Add/re-Add/replacement/renewal
- outcomes of scheduled cancellation, archive/cardless and recovery checks
- TEST Supabase advisor result

Do not record or share the service-account private key or JSON key file.

## 10. Production remains unchanged

Completion of this runbook does **not** authorize any Production action. After TEST passes, the owner receives a separate explicit rollout gate covering Production migration, Production issuer/service-account/Vercel configuration, Production namespace, PR merge/deploy, and normal daily-cron behavior. No manual Production cron trigger or real-member issuance occurs without separate approval.
