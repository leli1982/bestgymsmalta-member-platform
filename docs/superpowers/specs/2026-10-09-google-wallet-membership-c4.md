# C4 Google Wallet Membership Pass — Design

Date: 2026-10-09
Branch: `feature/google-wallet-c4`
Base: `main` at `ee5f51700adba53609ae3bd44e044e91ae6104ae`

## Intent

Add an optional Google Wallet version of the existing BestGymsMalta membership card without creating a second membership identity or weakening the existing gym-access rules.

The BestGymsMalta database remains the source of truth for:

- member identity;
- permanent BGM member number;
- membership status and expiry;
- cancellation/archive state;
- the current active physical-card barcode;
- whether a scanned credential grants access.

Google Wallet is only a synchronized presentation of that existing state.

Success means:

- an eligible signed-in member can tap an official **Add to Google Wallet** button from the member card page;
- the Wallet pass shows BestGymsMalta branding, member name, permanent BGM member number, status, expiry date, and the current active physical-card barcode;
- the Wallet barcode is exactly the same current credential value already exposed by `/api/member/card` and used by reception scanning;
- card replacement never creates a second usable credential and the old card remains rejected immediately by BGM even if Google synchronization is temporarily delayed;
- renewal, cancellation, archive, expiry, and card replacement are reflected on the same Wallet object instead of creating duplicate passes;
- the BGM expiry date itself remains a valid access day in Malta time;
- the existing seven-day C1 app grace period never extends gym access or Wallet validity;
- Google credentials/private keys never reach the browser;
- Google Wallet does not add a second expiry-notification channel alongside C3;
- no Production schema change or real-member pass issuance occurs before TEST, CI, Preview, and explicit owner approval.

## Existing BGM behavior to preserve

The current member-card API already returns the correct split between permanent identity and current access credential:

- `member.memberNumber` is the permanent BGM member number;
- `cardBarcode` / `physicalCardBarcode` is the current active physical-card credential;
- the app barcode encodes the active physical-card credential, not the lifetime member number;
- archived members are blocked;
- effective cancellation changes member status;
- membership expiry remains part of the member state.

The member card UI already renders the current barcode and displays the permanent BGM number separately.

Physical-card replacement is already centralized through the audited `bgm_replace_member_card` workflow. Replacement retires the old credential and activates the new one. C4 must reuse that model and must never introduce a separate Wallet credential allocator.

Staff scanning remains authoritative. A Wallet barcode that is stale because of a temporary Google API outage cannot grant access after its corresponding BGM card credential has been retired.

## External Google Wallet model

C4 uses Google Wallet **Generic Passes**:

- one `GenericClass` acts as the shared BestGymsMalta membership template;
- one stable `GenericObject` represents one BGM member pass;
- `genericType` is `GENERIC_GYM_MEMBERSHIP`;
- the barcode type is `CODE_128` when the member has a currently usable BGM card credential;
- existing objects are updated through the Google Wallet REST API rather than issuing a new object after every membership/card change;
- the Add to Google Wallet link is a signed JWT referencing the already-created object;
- service-account credentials sign/authenticate server-side requests only.

Official Google documentation used for this design:

- Generic pass classes/objects: https://developers.google.com/wallet/generic/overview/how-classes-objects-work
- Generic object REST resource: https://developers.google.com/wallet/reference/rest/v1/genericobject
- Barcode types: https://developers.google.com/wallet/reference/rest/v1/BarcodeType
- State enum: https://developers.google.com/wallet/reference/rest/v1/State
- Create objects: https://developers.google.com/wallet/generic/use-cases/create
- Update objects: https://developers.google.com/wallet/generic/use-cases/updates
- JWT/save flow: https://developers.google.com/wallet/generic/use-cases/jwt
- Web issuing flow: https://developers.google.com/wallet/generic/web
- Authentication: https://developers.google.com/wallet/generic/use-cases/auth

## Approaches considered

### 1. Stable server-managed Wallet object per BGM member — selected

Create one deterministic object ID per member, store its synchronization state in BGM, and update the same object whenever BGM state changes.

Advantages:

- no duplicate passes after renewal/card replacement;
- Wallet always mirrors the BGM identity model;
- card replacement can update the same pass;
- audit/retry state is visible inside BGM;
- signed save JWT stays small because it references an existing object;
- external failure cannot overwrite BGM membership/card state.

### 2. Create a fresh Wallet object on every Add action

Rejected because repeated saves, renewals, or replacements could create duplicate/outdated passes and would make lifecycle management ambiguous.

### 3. Issue a static snapshot and never synchronize it

Rejected because the barcode, membership status, and expiry can change. A static pass would inevitably display stale information and would be poor operational UX even though BGM scanning would still protect access.

## Identity and object IDs

The Google Wallet object ID must not depend on a mutable display field.

Use the immutable BGM member UUID to build a deterministic suffix, for example:

`<environment-prefix>member_<member-uuid>`

The complete Google object ID is:

`<GOOGLE_WALLET_ISSUER_ID>.<object-suffix>`

Hyphens in UUIDs are permitted by Google Wallet object IDs.

The permanent BGM member number remains a displayed business identifier only. If BGM member-number formatting changes in the future, the existing Google Wallet object ID does not change.

TEST and Production use different class suffixes/object prefixes so test objects cannot be confused with Production objects.

Example separation:

- TEST class suffix: `bgm_membership_test_v1`
- TEST object prefix: `test_`
- Production class suffix: `bgm_membership_v1`
- Production object prefix: `prod_`

Exact suffixes remain environment configuration rather than hard-coded secrets.

## Data model

Add a server-managed table:

### `bgm_google_wallet_passes`

- `member_id uuid primary key references bgm_members(id) on delete cascade`
- `object_id text not null unique`
- `class_id text not null`
- `sync_status text not null default 'pending' check in ('pending','synced','failed')`
- `last_attempt_at timestamptz null`
- `last_synced_at timestamptz null`
- `last_error text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

A row means BGM has provisioned a Google Wallet object for that member; it does **not** claim the user actually saved the pass to a particular Google account.

RLS is enabled. No direct anon/authenticated table grants are required. Member UI and synchronization operate through authenticated/server routes with the existing server-side Supabase client.

## Pending-sync trigger

Database triggers may mark an **existing** Wallet-pass row as `pending` when relevant BGM state changes, but they must never call Google or perform network work from PostgreSQL.

Relevant changes include:

### `bgm_members`

- membership expiry;
- status;
- cancellation effective date;
- archive/restore state;
- member name/member number fields that are displayed on the pass.

### `bgm_member_card_credentials`

- active credential inserted;
- active credential retired/replaced;
- credential reassigned;
- credential status/barcode changes.

Card changes must mark both the old and new member IDs pending when an assignment moves between members.

The trigger updates only a pre-existing `bgm_google_wallet_passes` row. It does not create Wallet rows for the full member database.

## Pass contents

The first version intentionally stays simple and readable.

### Shared class

- BestGymsMalta membership class;
- stable BGM branding/template;
- no Google-generated expiry/upcoming notification configuration;
- class is provisioned once per environment.

### Per-member object

When access-eligible:

- `genericType`: `GENERIC_GYM_MEMBERSHIP`
- `state`: `ACTIVE`
- card title: `BestGymsMalta`
- header: member full name
- permanent identifier: BGM member number
- status text: Active
- expiry text: DD/MM/YYYY
- barcode type: `CODE_128`
- barcode value: current active physical-card barcode
- barcode alternate text: current card number where useful
- BGM orange background / official BGM logo from a stable public HTTPS asset URL
- optional link back to the BGM member app/card page

Do not put the member photo into Google Wallet in C4. It is unnecessary for scanning, creates additional external personal-data exposure/caching concerns, and BGM staff already see the authoritative photo in the reception workflow after a scan.

## Eligibility to add/save

A member can create/save the Wallet pass only when all are true:

- authenticated with the existing member session;
- app member record exists and is not archived;
- membership status is active;
- no cancellation is effective today;
- membership expiry is today or in the future in Malta business-date terms;
- a current active physical-card credential exists;
- Google Wallet feature/configuration is enabled for that environment.

If these conditions are not met, the endpoint does not create a new Wallet object and the UI explains the relevant BGM-side reason in normal member language.

No Wallet pass can create eligibility that BGM itself does not have.

## Membership validity and Malta date semantics

C4 must preserve the standing rule that the membership expiry date itself is still valid.

If a membership expires on `2026-10-09`, the pass remains valid through the whole Malta calendar day of 9 October.

The Google `validTimeInterval.end` is therefore calculated as **the start of the following Malta calendar day converted to an absolute timestamp**, not as a naive UTC end-of-date string.

This handles Malta DST correctly and avoids shortening or extending the expiry day around clock changes.

The C1 seven-day member-app grace window is not Wallet validity. From the first Malta date after membership expiry, gym access is expired and the Wallet pass must no longer present an active scannable access credential.

## Wallet state mapping

### Active member with active card

- Google object `state = ACTIVE`
- `validTimeInterval.end` = next Malta midnight after BGM expiry date
- `barcode.type = CODE_128`
- `barcode.value` = current active BGM physical-card credential

### Membership expired / C1 grace / locked

- Google object is `EXPIRED` (or naturally transitions to expired because its validity interval passed);
- synchronization must not reactivate it because the app still allows renewal grace;
- the object must not expose a scannable active access credential after expiry synchronization.

### Effective cancellation, archive, inactive member, or no active card

- Google object `state = INACTIVE`;
- replace any prior scannable barcode with a non-access value such as a `TEXT_ONLY` status (`Membership inactive` / `Card unavailable`) so an old physical-card credential is not left displayed as if current.

### Renewal/reactivation

- update the existing object back to `ACTIVE`;
- apply the new expiry interval;
- restore `CODE_128` using the current active physical-card barcode.

## Google Wallet server module

Add a server-only module (working name `lib/googleWallet.ts`) responsible for all Google-specific behavior.

Responsibilities:

- load and validate environment configuration;
- create an authenticated Google Wallet client;
- build deterministic class/object IDs;
- convert BGM membership/card state into the complete BGM-owned Google object fields;
- ensure the environment class exists;
- insert a missing member object;
- update/patch an existing member object;
- generate a signed Add to Google Wallet JWT referencing the existing object;
- normalize private-key line breaks safely;
- report safe error messages without exposing credentials;
- update `bgm_google_wallet_passes` synchronization status.

This module is Node.js/server-only. Client components never import Google credentials or signing code.

Implementation should follow Google's current Node.js authentication/JWT guidance and official REST samples. Dependency choices are finalized in the implementation plan, but credentials and signing remain isolated in this module.

## Member API

Add a member-authenticated API surface under `/api/member/google-wallet`.

### `GET`

Purpose: lightweight capability/status for the member UI.

Returns server-derived information such as:

- feature available/configured;
- member currently eligible/ineligible;
- eligibility reason suitable for UI mapping;
- whether a Wallet object has already been provisioned;
- last sync status/time where useful.

It never returns issuer private credentials, private key material, Google access tokens, or raw synchronization errors containing secrets.

### `POST`

Purpose: create/update the member's Wallet object and return a signed save URL.

Flow:

1. require existing member session;
2. load canonical BGM member/current active card state server-side;
3. enforce eligibility;
4. create/upsert `bgm_google_wallet_passes` mapping;
5. ensure the Google class/object exists;
6. synchronize the object to the latest BGM state;
7. generate a signed JWT referencing the existing object;
8. return the `https://pay.google.com/gp/v/save/...` URL.

The browser navigates to that returned URL after the user taps the official Google button.

The POST endpoint must be safe to repeat. Repeated presses update/reference the same object rather than creating duplicates.

## Member UI

Add the official Google-provided **Add to Google Wallet** button to the full member card view, near the digital-card controls/details.

Rules:

- use Google's official button asset/branding requirements rather than drawing a lookalike button;
- do not replace the existing BGM digital card;
- loading state prevents duplicate POST requests;
- if Google Wallet is unavailable/unconfigured, do not show a broken action;
- if the member is currently ineligible, show a concise BGM-side reason rather than a misleading save flow;
- if the object already exists, the same action may still be offered because Google handles whether it is already saved to the signed-in Google account;
- no user-agent-only security decision is made; server-side BGM eligibility remains authoritative.

Android/Google Wallet is the primary C4 target. iPhone/Apple Wallet is not implemented in this phase.

## Synchronization architecture

C4 uses **BGM-first, Google-second** mutation semantics.

A BGM membership/card operation must never be rolled back merely because the Google Wallet API is temporarily unavailable.

### Immediate best-effort synchronization

After a successful BGM operation that materially changes an existing Wallet pass, application routes/services should attempt `syncGoogleWalletPassForMember(memberId)` after the canonical BGM transaction is complete.

Mandatory mutation classes include:

- physical-card replacement/reassignment;
- membership renewal/activation;
- cancellation becoming effective;
- archive/restore;
- Super Admin edits to expiry/status/display identity fields.

The implementation plan must enumerate the actual centralized route/RPC integration points in the current repository before code changes are made.

If Google synchronization fails:

- the BGM mutation remains successful;
- the pass row becomes `failed` or remains `pending` with a safe error summary;
- BGM scanning continues to enforce the new source-of-truth state immediately.

### Recovery synchronization

Add an idempotent recovery engine that processes Wallet rows with `pending`/`failed` status in bounded pages.

To avoid unnecessary Vercel Cron proliferation, the preferred design is to invoke this recovery engine as an independently caught third engine from the existing secured daily membership/member-engagement cron route. The historical route name may remain; its response/logging should report Wallet sync separately.

One Wallet failure must not fail expiry reminders, C3 engagement notifications, or other Wallet members.

A member pressing Add to Google Wallet also forces a fresh synchronization before a save URL is returned, providing an additional self-healing path.

## Card replacement safety

Card replacement is the highest-risk synchronization case.

Required behavior:

1. BGM replacement transaction retires old barcode and activates new barcode atomically as it does today.
2. Any scan of the old barcode is rejected by BGM immediately after replacement, independent of Wallet.
3. Existing Wallet row is marked pending.
4. Best-effort Google sync updates the same object to the new barcode.
5. If Google is temporarily unavailable, the old Wallet display may be stale but cannot restore access because reception validates against BGM.
6. Recovery sync later replaces the visible stale barcode.

C4 never makes Google Wallet the credential validator.

## Class/object update strategy

The application owns the BGM-specific fields on its GenericObject and can deterministically rebuild them from BGM state.

For an existing object, use Google Wallet REST update/patch semantics deliberately:

- `PATCH` is preferred for normal field changes;
- explicitly overwrite state/barcode fields when eligibility changes so a retired barcode is not accidentally left visible;
- if implementation uses full `update`/PUT for any path, it must construct the complete BGM-owned object because omitted fields are cleared by Google.

The sync helper first distinguishes Google `404` (object missing -> recreate) from authentication/configuration errors and normal API failures.

## Google-generated notifications

Do **not** enable `expiryNotification` or `upcomingNotification` on the Google GenericObject in C4.

BGM already owns expiry communication through C3/member notification preferences. Enabling Google's independent expiry notification would create an additional uncontrolled channel that does not respect BGM's notification preference model.

Wallet state/expiry rendering is still used; only Google-triggered expiry/upcoming push notifications are omitted.

## Configuration and secrets

Expected server-side configuration:

- `GOOGLE_WALLET_ENABLED`
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLASS_SUFFIX`
- `GOOGLE_WALLET_OBJECT_PREFIX`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY`
- canonical allowed/origin URL if required by the signed save-JWT implementation

Names may be adjusted during planning to match existing env conventions, but the separation must remain.

Rules:

- feature fails closed when required configuration is missing;
- private key is a Vercel secret and never committed;
- service-account private key is never returned to the client;
- do not ask the owner to paste private key material into chat;
- TEST/Preview and Production use distinct class/object naming even if the Google Issuer account is shared;
- Production configuration is not enabled until explicit rollout approval.

## Google-side setup prerequisite

C4 requires one-time external setup outside the repository:

1. BestGymsMalta obtains/configures a Google Wallet Issuer account in the Google Wallet Business Console.
2. Google Wallet API is enabled in the chosen Google Cloud project.
3. A dedicated service account is created with least privilege needed for Wallet issuance.
4. That service account is authorized in the Wallet issuer account.
5. Preview/TEST credentials/config are added directly to Vercel secrets.
6. A TEST class/object is created and manually saved by an approved test Google account/device.
7. Publishing access/status is confirmed before real-member Production issuance.

Any Google console action requiring the owner's account remains a user-authorized setup step; repository implementation must not invent issuer IDs or credentials.

## Observability and audit behavior

For each provisioned pass, BGM records:

- deterministic object ID/class ID;
- current sync status;
- last attempt time;
- last successful sync time;
- sanitized last error.

Server logs may include member UUID/object ID and Google HTTP status but must not include:

- service-account private key;
- access tokens;
- signed save JWTs/save URLs;
- full credential JSON.

No separate user-facing Super Admin Wallet dashboard is required in C4. Database/audit information plus server logs are sufficient for the first release unless implementation reveals an operational blocker.

## Security and privacy

- BGM remains the authorization/access source of truth.
- Google receives only the member/pass information required to render the Wallet pass.
- Member photo is excluded.
- Service-account key remains server-only.
- All new DB state is RLS-protected/server-managed.
- Member Wallet endpoints require the existing authenticated member session.
- No endpoint accepts a client-supplied member ID as authority for whose pass to issue.
- Save JWT references the server-created object; it does not trust browser-submitted pass contents.
- CSRF/same-origin expectations follow the existing member API pattern.
- Google API failures never weaken card-retirement, cancellation, expiry, or archive enforcement.
- Signed save URLs/JWTs are treated as short-lived delivery artifacts and are not persisted in BGM.

## Testing strategy

### Pure/unit tests

Test:

- deterministic TEST/Production object IDs;
- member UUID sanitization/allowed characters;
- active/inactive/expired state mapping;
- active credential becomes `CODE_128` with exact barcode value;
- no-card/inactive member never retains a scannable old barcode in desired state;
- C1 grace maps to expired Wallet access;
- permanent BGM member number remains display-only and is not used as the access barcode;
- Malta expiry conversion uses next local midnight;
- Malta DST boundary dates produce correct absolute timestamps;
- signed JWT payload references only the expected existing object/class and contains no private-key data;
- configuration fails closed.

### Database/contract tests

Test:

- migration creates server-managed RLS-protected Wallet table;
- unique object ID and one-row-per-member constraints;
- pending trigger marks only existing pass rows;
- relevant member changes mark pending;
- card replacement/reassignment marks the affected pass rows pending;
- trigger performs no network/external operation;
- member API requires session and ignores client attempts to target another member;
- repeated POST does not create a second object ID;
- Google 404 path can recreate the deterministic object;
- failed Google sync never reverses the successful BGM mutation;
- recovery processing is paged/idempotent.

### Mocked Google API tests

No Google private credentials belong in CI.

Use mocked/fake transport around the Google adapter to test:

- class exists/missing flows;
- object insert;
- object patch;
- expired/inactive barcode replacement;
- authentication failure;
- rate-limit/5xx failure -> pending/failed state;
- recovery retry -> synced state;
- generated save link format without logging the signed token.

### Browser tests

Test Preview member-card UI for:

- eligible member sees official Add to Google Wallet action;
- ineligible/no-card member cannot start a save request;
- loading/double-click protection;
- API failure produces safe retry UX;
- existing BGM barcode/card behavior remains unchanged.

### Manual Google Wallet verification

Before Production rollout, use TEST Supabase + Preview + approved Google test account/device to verify:

1. active test member saves the pass;
2. displayed name/BGM number/expiry are correct;
3. Wallet `CODE_128` scans through the normal BGM reception workflow;
4. replacing the TEST member card retires the old barcode immediately in BGM and updates the same Wallet pass to the new barcode;
5. old Wallet barcode cannot grant access after replacement even during forced sync failure;
6. membership expiry makes Wallet non-active while C1 app grace still permits only renewal access;
7. renewal reactivates the same Wallet object with the new expiry/current card;
8. cancellation/archive moves the pass inactive;
9. Google-generated expiry notification is not enabled.

### Regression suite

Run the full existing Phase 2 CI suite before merge, including member card/barcode, card replacement, renewal, expiry/grace, cancellation/archive, Staff reception/scanner, Super Admin, import/export, and all existing browser/screenshot stages.

## TEST and Production rollout

All database/application development starts against TEST Supabase only.

No Production database migration or Google real-member issuance is authorized by approval of this design/spec alone.

Before any Production database/configuration change:

1. implement on `feature/google-wallet-c4` from the released `main` base;
2. apply additive migration to TEST only;
3. configure Preview Google Wallet credentials directly in Vercel secrets;
4. complete mocked automated tests;
5. complete manual TEST Wallet save/scan/replacement/expiry/renewal verification;
6. run Supabase advisors/security checks;
7. run full Phase 2 CI and Vercel Preview build;
8. present the exact Production migration and environment/configuration actions for owner approval;
9. only after explicit approval, apply Production migration/configuration and merge/deploy;
10. verify the exact merge commit is READY in Vercel Production before calling C4 live.

Do not manually provision/send real-member passes as part of release verification.

## Rollback behavior

The feature is additive.

If Google Wallet must be disabled:

- set `GOOGLE_WALLET_ENABLED=false` / remove the member save action;
- BGM digital card and physical scanning continue unchanged;
- existing Google passes can be moved inactive by a controlled server sync if required;
- leaving the Wallet tracking table in place is safe and preserves audit/retry history;
- no member identity or physical-card data needs to be rewritten.

The DB migration should therefore avoid destructive changes to existing membership/card tables.

## Acceptance criteria

C4 is complete only when all are true:

- one stable Google GenericObject is used per BGM member;
- TEST and Production object namespaces are separated;
- Wallet pass uses `GENERIC_GYM_MEMBERSHIP`;
- active Wallet barcode is `CODE_128` and exactly matches the member's current active BGM physical-card credential;
- permanent BGM number is displayed separately and is never substituted as the scanner credential;
- expiry day remains valid through Malta local midnight;
- C1 grace never extends Wallet/gym access;
- renewal/card replacement/cancellation/archive synchronize the existing object;
- no stale retired barcode can regain BGM access;
- non-eligible objects do not present a scannable active credential after synchronization;
- official Add to Google Wallet branding is used;
- Google service-account secrets stay server-only;
- Google expiry/upcoming notifications are not enabled;
- TEST manual Wallet scan/replacement/expiry/renewal scenarios pass;
- full BGM regression CI and Vercel Preview are green;
- Production rollout receives separate explicit owner approval.

## Out of scope for C4

- Apple Wallet / PassKit;
- Google Smart Tap / NFC terminal redemption;
- replacing BGM reception validation with Google validation;
- generating a second QR/barcode identity;
- storing member photos in Google Wallet;
- Google-generated expiry/upcoming push notifications;
- marketing offers/coupons in Wallet;
- location-triggered Wallet notifications;
- Wallet passes for staff;
- Wallet admin dashboard/reporting beyond sync records/logs;
- payroll/punch-clock work;
- C5 AI Trainer exercise illustration library.
