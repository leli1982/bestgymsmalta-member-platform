# BestGymsMalta Phase 2 Operations, NFC & Redesign — Design

## Goal

Expand the existing BestGymsMalta member platform into three coordinated experiences without breaking current member functionality:

1. Member App
2. Staff / Reception Mode
3. Super Admin / Management Portal

The platform remains one Next.js application backed by Supabase and deployed through Vercel Preview before any production merge.

## Non-Negotiable Compatibility Rules

- Existing member login, member card, QR check-ins, passport, announcements, analytics, progress, progress photos, mobility/stretch, trainer, story creator and gym locations must continue working.
- Work happens only on `phase-2-operations-nfc-redesign` until Preview regression testing is accepted.
- BestGymsMalta membership is network-wide. A member may use any BGM gym. Enrollment/joining gym is reporting context only and must never restrict member visibility or access.
- `bgm_members.status` and `bgm_members.membership_expiry` remain compatibility fields during migration.
- Member-private APIs must derive authorization from the signed server-side member session, never trust a supplied `memberId` by itself.

## Member Authentication Foundation

Existing member credentials stay in `bgm_members` using the current bcrypt password hashes. Successful login or activation issues a signed HttpOnly member-session cookie. The browser may keep localStorage member data for UI convenience, but localStorage is never authorization.

Private member API requests must verify that the signed session member ID matches any requested member ID before querying Supabase or returning signed private-storage URLs.

## Staff / Gym Account Model

There is one shared operational login per gym, not one login per employee.

Examples:

- `birkirkarafitness`
- `sliemafitness`
- `marsafitness`

Each gym account has a unique password and a granular permission set managed by Super Admin. Gym accounts identify the operating gym/system account, not the human staff member.

There is no staff sub-login and no staff-session selection screen.

### Staff Name

Operational forms that need human accountability contain a required `Staff Name` field. Examples include:

- new membership
- membership renewal
- activation/payment confirmation
- NFC assignment/replacement
- sundries orders
- bar orders
- other future operational forms where staff attribution matters

Saved records and audit entries store both the authenticated gym account and the entered staff name. Super Admin can filter reports by staff name, gym account, date, action and affected member/order.

## Super Admin

Super Admin has unrestricted access and is not governed by gym-account permissions. Super Admin does not require Staff Name verification for administrative configuration actions unless a specific business form itself requires Staff Name.

Super Admin can:

- create/edit gyms
- create/reset gym usernames and passwords
- enable/disable gym accounts
- assign granular permissions per gym account
- view the complete member database
- view audit history
- manage membership operations, NFC, orders, analytics and settings

When adding a new gym, Super Admin can create its operational username/password as part of the gym setup.

## Granular Gym Permissions

Permissions control actions, not which members a gym can see. If a gym account has `members.view`, it can view all members across BGM.

Initial permission keys:

- `members.view`
- `members.create`
- `members.edit`
- `members.renew`
- `members.activate`
- `members.archive`
- `members.export`
- `member_photos.view`
- `member_photos.capture`
- `nfc.scan`
- `nfc.assign`
- `nfc.replace`
- `checkins.view`
- `sundries.submit`
- `sundries.view_history`
- `sundries.update_status`
- `bar.submit`
- `bar.view_history`
- `bar.update_status`
- `announcements.manage`
- `analytics.view`
- `gyms.manage`
- `users.manage`

Super Admin bypasses permission checks.

## Enrollment & Membership Model

`bgm_members` remains the person/app-account compatibility record. New normalized records model applications and membership contracts without removing the existing compatibility fields.

### Membership Types

- Single
- Couples
- Student

### Durations

- 1 week
- 2 weeks
- 1 month
- 3 months
- 6 months
- 1 year

### Tablet Enrollment

Front-desk tablet flow:

1. Choose membership type (Single default / Couples / Student).
2. Choose duration.
3. Complete enrollment form.
4. Capture official member photo.
5. Submit and print the filled membership form.
6. Reception receives the pending application.
7. Reception reviews/cancels or confirms payment.
8. `PAYMENT RECEIVED — ACTIVATE` activates the member.
9. Assign NFC card.

Printing never activates a membership.

For Couples, one application/contract links two separate member person records. Each person has their own member number, official photo, NFC card and app identity.

`Gym Location` on the current paper form becomes `enrollment_gym_id` / joining location for reporting only.

## Member Enrollment Fields

The digital enrollment model must support the current form data:

- first name / surname or full name
- address
- postcode
- ID number
- date of birth
- telephone
- email
- duration / time period
- starting date
- expiry date
- next of kin
- new membership / renewal context
- enrollment gym
- membership type
- official profile photo
- Staff Name
- declaration/rules version accepted
- printable application reference

Do not invent student proof/school fields unless separately requested.

## Official Member Photos

Official enrollment/member photos are separate from personal progress photos.

- New private Storage bucket, e.g. `bgm-member-photos`.
- Never public.
- Access only through authorized server routes/signed URLs.
- Any gym account with `member_photos.view` can view official photos for all members.

## NFC

NFC identity is network-wide:

`card UID -> active card record -> member -> membership status -> access decision`

The scanned gym is recorded on the access/check-in event only.

Card states include active, disabled and replaced.

Every scan attempt is logged, including:

- granted
- expired
- inactive
- unknown card
- disabled/replaced card

Granted NFC scans create the same canonical member check-in used by QR check-ins, with `source = 'nfc'`, so passport and analytics continue to work.

Denied scans do not create normal member check-ins.

### Reception Scan UX

Default: `READY TO SCAN`.

Granted:

- full member photo
- full name
- member number
- membership expiry
- enrollment context
- large green `ACTIVE`
- success sound
- automatic check-in

Denied/expired:

- full member photo when identified
- large red warning
- `EXPIRED` / inactive reason
- expiry date
- warning sound
- staff actions as permitted

The UI must prioritize speed, legibility and minimal interaction under front-desk pressure.

## Orders

### Sundries

Staff creates a sundries order with required Staff Name. The database is the source of truth. After successful database save, an email notification is sent to the configured manager address.

Statuses:

- submitted
- ordered
- completed
- optionally cancelled

Email failure must not lose the saved order; notification status remains retryable.

### Bar Orders

Use the same account/Staff Name/audit/permission architecture as sundries. Exact fields/items can be added when the bar form is designed.

## Audit History

Meaningful operational mutations record:

- authenticated system/gym account ID
- gym context
- Staff Name when the form requires it
- action key
- entity type and entity ID
- affected member/order where relevant
- before snapshot where useful
- after snapshot where useful
- timestamp

Audit records should be append-oriented and not editable by ordinary gym accounts.

## Offline Emergency Roster

Every gym computer must retain a local emergency list of all currently active BGM members.

The offline roster contains only:

- member number
- full name

No contact details, dates of birth, photos or other PII are stored in the emergency roster.

### Sync Behavior

The staff PWA stores the roster locally using IndexedDB or equivalent durable browser storage.

Refresh rules:

- official daily refresh around midnight while the app is running
- refresh on first app opening if the device missed the scheduled refresh
- refresh when online and the cached list is stale
- optional additional periodic refresh while online

Each successful sync replaces the prior roster atomically.

### Offline UX

The staff PWA core shell must be cached so it can open without internet.

When offline:

- show prominent `OFFLINE MODE`
- show `Last synced` timestamp
- allow read-only search by member number or name
- label results as active according to the last successful sync
- warn clearly when the cache is old

Initial offline mode is read-only. No offline renewals, edits, payments, NFC assignments or order submissions until a future conflict-safe synchronization design is explicitly approved.

Super Admin also gets a manual `Download Current Active Members CSV` export containing only member number and full name.

## Data Model Direction

New Phase 2 tables are expected to include:

- `bgm_system_users` — Super Admin and shared gym operational accounts
- `bgm_user_permissions` — permission keys per system user
- `bgm_membership_applications` — tablet/pending workflow
- `bgm_memberships` — activated membership contracts
- `bgm_membership_members` — links membership contracts to one or two member records
- `bgm_nfc_cards` — unique NFC card UIDs and lifecycle
- `bgm_access_scans` — every access attempt
- `bgm_audit_log` — operational audit history
- `bgm_sundries_orders`
- `bgm_sundries_order_items`
- `bgm_bar_orders`
- `bgm_bar_order_items`

Existing tables remain in place unless a controlled migration explicitly replaces a behavior.

## Security & RLS

- Public data remains limited to explicitly public content such as active announcements and gym information.
- New operational tables have RLS enabled.
- Authenticated does not automatically mean authorized; server routes verify account identity and granular permission.
- Shared gym accounts must never receive the Supabase service-role key.
- Server-only secrets remain in server environment variables.
- Official member photos remain private.
- Super Admin bypass is implemented server-side, not by hiding/disabling UI controls only.

## CSV Member Import

Current destructive CSV synchronization is unsafe once Phase 2 relational records exist. Normal import becomes non-destructive preview/upsert:

- New
- Updated
- Unchanged
- Conflicts

Rows omitted from a CSV are never automatically deleted. Archive/deactivate becomes a separate privileged operation.

## UI Direction

### Staff / Admin

Light business-oriented UI:

- white / soft grey surfaces
- BGM orange accent
- charcoal text
- large clear status states
- minimal clutter

Primary management navigation:

- Overview
- Members
- Reception
- Staff & Access / Gym Accounts
- Gyms
- Check-ins
- Sundries
- Bar Orders
- Announcements
- Analytics
- Settings

### Member App

Member visual redesign happens after operational/auth/database foundations. Existing features remain available throughout migration.

## Deployment & Testing

- No work directly on `main`.
- Database migrations are authored in Git first.
- Do not apply Phase 2 schema to the live Supabase database until a controlled migration point is explicitly reached.
- Use Vercel Preview builds throughout.
- Expand existing `QA_CHECKLIST.md` with session-security, shared gym account, permissions, enrollment, NFC, orders and offline-mode regression tests.
- Merge to `main` only after Preview testing is confirmed.
