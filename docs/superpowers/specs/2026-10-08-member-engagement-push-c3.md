# C3 Member Engagement Push Notifications — Design

Date: 2026-10-08
Branch: `feature/member-engagement-push-c3`
Base: `main` at `5c8c4565c793bb924805c2d85536edb1f147d8b8`

## Intent

Extend the existing BestGymsMalta member notification stack so enrolled members can receive useful closed-app push notifications for attendance engagement while keeping membership-expiry reminders, member privacy, and gym-entry rules intact.

Success means:

- existing membership expiry reminders keep working;
- members can separately control critical membership pushes and motivational pushes;
- members can receive one inactivity reminder after 3 complete Malta calendar days without a successful gym visit;
- members can receive streak milestone pushes at 3, 5, 7, 14, and 30 consecutive Malta attendance days;
- duplicate cron runs never duplicate a notification;
- expired, cancelled, archived, or otherwise physically ineligible members never receive motivational "come to the gym" prompts;
- invalid Web Push subscriptions are automatically deactivated;
- Android/Chrome remains fully supported and iPhone/iPad Home Screen PWA behavior is explicitly handled and manually verified;
- no new third-party push provider is introduced.

## Existing infrastructure to reuse

The application already has the core Web Push plumbing needed for C3:

- `bgm_member_push_subscriptions` stores per-device member subscriptions;
- `/api/member/push` creates and removes member subscriptions;
- `public/member-push-sw.js` displays push notifications and handles notification clicks;
- `lib/memberPushNotifications.ts` sends member expiry pushes and deactivates 404/410 subscriptions;
- `bgm_member_notifications` provides the member in-app notification centre with dedupe keys;
- `lib/membershipReminderEngine.ts` already creates in-app expiry reminders and closed-app Web Push reminders;
- `/api/cron/membership-expiry-reminders` is protected by `CRON_SECRET`;
- `vercel.json` already runs the secured daily reminder cron;
- notification dates already use Malta-calendar helpers.

C3 therefore extends this system instead of creating a second notification architecture.

## Approaches considered

### 1. Extend the existing VAPID + Supabase + Vercel stack — selected

Add engagement calculation, member category preferences, durable event dedupe, and UI controls around the existing subscription/sender/service-worker infrastructure.

Advantages:

- smallest operational footprint;
- no new vendor or recurring service cost;
- reuses already-tested expiry push behavior;
- keeps member identity and attendance logic inside BGM;
- easiest rollback path.

### 2. Add a third-party push platform such as OneSignal

Rejected for this phase because it duplicates subscription/member state, introduces another data processor and cost surface, and does not solve the BGM-specific eligibility/dedupe logic.

### 3. Trigger engagement pushes directly from database events

Rejected because inactivity is inherently time-based and streak logic is easier to audit and test in the application layer. A daily idempotent engine is simpler and safer.

## Notification categories and member controls

A member has two account-level push categories:

- **Critical membership notifications** — membership expiry/reminder pushes.
- **Motivational notifications** — inactivity and streak milestone pushes.

The browser/device subscription remains a separate device-level permission. A member may have multiple subscribed devices, while category preferences apply to the member account across all devices.

When no preference row exists, both categories default to enabled. No push can actually be delivered unless the member has explicitly granted browser notification permission and has an active stored subscription.

Disabling push on one device removes only that device subscription. Category toggles do not delete subscriptions.

## Data model

### `bgm_member_notification_preferences`

Server-managed account preferences:

- `member_id uuid primary key references bgm_members(id) on delete cascade`
- `critical_enabled boolean not null default true`
- `motivational_enabled boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS is enabled. The member UI reads/writes it only through authenticated Next.js routes using the existing member session and server-side Supabase client. No public client-side direct table access is required.

### `bgm_member_engagement_settings`

Single Super Admin-controlled rollout row:

- `id text primary key check (id = 'member_engagement')`
- `enabled boolean not null default false`
- `inactivity_enabled boolean not null default true`
- `streak_enabled boolean not null default true`
- `updated_by_system_user_id uuid null references bgm_system_users(id) on delete set null`
- timestamps

Thresholds remain fixed in code for C3: 3 inactivity days and streak milestones 3/5/7/14/30. This avoids unnecessary configuration complexity while preserving a global kill switch and per-feature switches.

### `bgm_member_engagement_notification_log`

Durable idempotency/audit log:

- `id uuid primary key default gen_random_uuid()`
- `member_id uuid not null references bgm_members(id) on delete cascade`
- `event_type text check in ('inactivity','streak')`
- `event_key text not null`
- `event_date date not null`
- `status text check in ('pending','sent','skipped','failed')`
- `reason text null`
- `error_text text null`
- `attempted_at`, `sent_at`, `created_at`, `updated_at`
- unique `(member_id, event_key)`

The unique claim is the concurrency/deduplication guard. Re-running a cron or overlapping invocations cannot send the same event twice.

All new tables have RLS enabled. Because Supabase is moving new tables toward explicit Data API exposure, C3 does not depend on automatic public exposure; these tables remain server-managed.

## Attendance source of truth

Engagement uses only successful canonical physical gym check-ins already stored in `bgm_member_checkins` with source in:

- `qr`
- `nfc`
- `barcode`

Multiple successful check-ins on the same Malta calendar date count as one attendance day for streak purposes.

No staff/admin/manual synthetic attendance record is introduced.

## Motivational eligibility

A member may receive motivational notifications only when all are true:

- member is app-enrolled;
- member is not archived;
- member status is active;
- no effective cancellation blocks access;
- membership expiry is today or in the future in Malta business-date terms;
- motivational category is enabled;
- at least one active member push subscription exists.

This intentionally excludes C1 grace/locked members because an expired member cannot physically enter the gym and must not receive a misleading "come train" prompt.

## Inactivity rule

A member qualifies when the latest successful canonical physical check-in is exactly 3 complete Malta calendar days behind the current Malta business date and there has been no later successful check-in.

Examples:

- last attendance 5 Oct, business date 8 Oct -> eligible;
- last attendance 6 Oct, business date 8 Oct -> not yet eligible;
- multiple visits on 5 Oct -> still one inactivity episode.

Members with no successful canonical check-in are skipped in C3. This avoids sending a potentially confusing inactivity message to newly enrolled members before they have established a normal attendance history.

Only one inactivity notification is sent for an inactivity episode. The event key is based on the last attendance Malta date, e.g. `inactivity:2026-10-05`. After the member checks in again, a later 3-day lapse forms a new episode and may notify again.

Suggested message:

- Title: `We miss you at BGM 💪`
- Body: `It’s been 3 days since your last workout. Ready for the next one?`
- Target: `/gyms`

## Streak rule

A streak is consecutive Malta calendar dates on which the member has at least one successful canonical physical check-in.

Milestones: **3, 5, 7, 14, 30** consecutive attendance days.

Rules:

- multiple visits on one date count once;
- any Malta calendar date with no successful check-in breaks the streak;
- a new streak may earn the same milestones again;
- an event key combines streak start date and milestone, e.g. `streak:2026-10-01:7`;
- notifications are evaluated from recorded attendance, never from local device state.

Suggested messages:

- 3: `3-day streak 🔥`
- 5: `5 days strong 💪`
- 7: `One full week! 🔥`
- 14: `14-day streak — serious consistency 👏`
- 30: `30 days. Outstanding consistency 🏆`

Target: `/passport`.

## Push delivery architecture

Refactor the existing member push sender into a generic internal delivery helper that accepts a payload and member ID while preserving the current behavior:

- load all active subscriptions for the member;
- use the existing VAPID config;
- send to every active device;
- reset failure count on success;
- increment failure count on failure;
- deactivate subscriptions returning HTTP 404 or 410;
- report sent/failed/subscription counts.

The current membership-reminder function becomes a small wrapper over this helper. Engagement pushes use the same helper.

The service worker continues to display standard title/body/url/tag payloads; no second service worker is added.

## Daily engine and cron

Do not add another scheduled job unless necessary.

Extend the existing secured daily member-notification cron so it runs two independently caught engines:

1. existing membership expiry reminders;
2. new member engagement notifications.

The endpoint remains protected by `CRON_SECRET` and remains a Node.js route. Each engine returns its own summary. One engine failing must not hide the status of the other in logs/response.

This keeps the Vercel Hobby deployment simple and avoids unnecessary cron duplication.

The engagement engine uses Malta business dates for all calculations. It processes members/check-ins in pages/chunks rather than loading the entire member database in one query.

## Member UI

Upgrade the existing `MemberReminderNotifications` card into a broader **App notifications** section.

States:

- unsupported browser;
- permission not granted;
- device subscribed;
- device not subscribed.

When subscribed, show two account toggles:

- `Membership & account reminders`
- `Motivation & streaks`

Also retain:

- enable notifications on this device;
- disable notifications on this device;
- local test notification.

### iPhone/iPad handling

If Web Push APIs are unavailable on iOS Safari and the app is not running as an installed Home Screen PWA, show a concise instruction that notifications require installing BestGymsMalta to the Home Screen first. Do not claim support when the browser APIs are absent.

Actual iOS push receipt remains a manual-device verification item because CI cannot emulate Apple Push delivery reliably.

## Super Admin UI

Add a small `Member engagement notifications` control to the existing notification settings area:

- global Enabled/Disabled;
- inactivity notifications Enabled/Disabled;
- streak notifications Enabled/Disabled.

No message-template editor or arbitrary campaign sender is added in C3.

## In-app notification centre

When an engagement event is claimed, create a matching `bgm_member_notifications` item with the same semantic dedupe key. This keeps the Bell/notification centre consistent with pushes.

If the motivational category is disabled, no motivational in-app event is created by the engagement engine.

Critical expiry in-app behavior remains governed by the existing reminder system and is not weakened by this phase.

## Error handling and idempotency

- claim event in the engagement log before creating/sending;
- unique `(member_id,event_key)` prevents duplicate delivery;
- failed sends are recorded, not silently retried in the same run;
- 404/410 subscriptions are deactivated;
- one bad subscription does not block other devices;
- one member failure does not abort the whole daily batch;
- global disabled state exits cleanly without touching members;
- cron remains safe to rerun.

## Security and privacy

- VAPID private key never reaches the browser;
- subscription endpoints and keys remain server-side data;
- all new tables have RLS enabled;
- member preference routes require the existing authenticated member session;
- Super Admin engagement settings require existing Super Admin authorization;
- cron requires `CRON_SECRET`;
- service-role credentials remain server-only;
- no new external notification vendor receives member data.

## Testing strategy

### Pure/unit tests

Test:

- Malta date conversion around UTC/day and DST boundaries;
- same-day duplicate visits count once;
- exact 3-day inactivity threshold;
- inactivity episode dedupe;
- streak lengths and breaks;
- milestones 3/5/7/14/30;
- a new streak can earn milestones again;
- expired/grace/locked/cancelled/archived members are excluded from motivation;
- preference defaults and category suppression;
- deterministic event keys/payloads.

### Contract/integration tests

Test:

- member preference API requires member session;
- member can update only their own preferences;
- Super Admin settings require Super Admin auth;
- engagement log unique claim prevents duplicates;
- generic push sender preserves 404/410 deactivation behavior;
- expiry reminder sender still behaves exactly as before;
- cron authorization remains required;
- daily route reports both expiry and engagement summaries.

### Browser tests

Test:

- notification UI feature detection;
- subscribe/unsubscribe flow;
- category toggles;
- local test button remains available when subscribed;
- unsupported environment guidance;
- existing member notification centre still renders engagement items.

### Regression suite

Run the full existing Phase 2 CI suite before merge, including all Staff, Super Admin, member-card, gym, import/export, print, photo-warning, renewal, and tablet browser checks.

## Database rollout

Development and migration verification happen against TEST Supabase only first.

No Production database migration is applied without explicit user approval.

Before any Production migration:

1. verify TEST schema/query behavior;
2. run Supabase advisors/security review;
3. confirm migration is additive and rollback-safe;
4. verify application CI is green;
5. present the exact Production change for approval.

## Rollout safety

`bgm_member_engagement_settings.enabled` defaults to **false**, so deploying schema/code cannot start motivational notifications by itself.

After Production migration/deployment is verified, Super Admin can explicitly enable engagement notifications. Existing expiry reminders continue independently.

## Out of scope for C3

- Google Wallet / Apple Wallet membership passes;
- marketing campaigns or bulk arbitrary push composer;
- geofenced notifications;
- AI-generated notification copy;
- per-gym promotional pushes;
- configurable custom streak thresholds;
- changing physical gym access rules;
- changing membership expiry/grace rules;
- payroll work.
