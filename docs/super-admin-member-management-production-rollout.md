# BestGymsMalta: Super Admin member-management production rollout checklist

**Status: TEST verified; Production rollout is NOT approved or started.**
Scope: Super Admin member profile/gym/date correction, individual and joint cancellation, Archive, Restore, guarded Delete. Staff Portal permissions and existing operational flows must remain unchanged. Do not merge feature code, change Production Supabase, update Production Vercel, or link TEST secrets to Production without a separate explicit approval.

## 1. Approval and data-retention gate

- [ ] BGM product owner confirms the precise production feature scope and authorises a separate release window. Record the approved Git commit and target environment.
- [ ] BGM's designated privacy/legal reviewer documents retention periods by record category (memberships, invoices/payment transactions, applications/consents, photos, access logs, audit records, import source files, exports, backups). Determine whether an erasure/anonymisation workflow is required for linked records. Do not represent the current guarded Delete as a general GDPR erasure tool.
- [ ] Keep **permanent deletion disabled for real Production members** until retention, external-storage, backup and identity-clearing policies are approved. Current guarded Delete intentionally refuses any member with linked membership contracts, cards, photos, visits, activity or audit history; it is only for unused member profiles with no detected dependencies.
- [ ] Confirm Super Admin-only ownership of all three actions. Staff Portal must have no new archive, restore or delete controls or privileges.

## 2. Release inventory and TEST evidence

- [ ] Record immutable feature commit SHA, clean CI run (unit tests, TypeScript, Next.js build, Chromium browser flows) and explicit TEST Preview deployment ID; confirm feature Preview auto-deployment gate is OFF after review.
- [ ] Confirm TEST Supabase is the isolated test project, not Production; verify both browser/server Supabase URLs and service-role secret source. Never copy a TEST secret into Production or vice versa.
- [ ] Review all feature-branch changes against `main`, including unrelated staff, bar, enrollment or scanner work. Avoid merging unapproved work as part of this module.
- [ ] Compare live Production database schema, policies, functions, triggers, migration history, app code, Vercel deployment settings and environment values with the reviewed branch. Do not assume TEST migration history is identical to Production.

## 3. Backups and reversibility

- [ ] Take a Production database backup/snapshot under BGM's approved backup procedure and **verify recoverability**. Record timestamp and snapshot identifier securely.
- [ ] Preserve the current known-good Production deployment ID and at least the agreed rollback points. Confirm domain and routing changes are not needed.
- [ ] Capture baseline read-only counts and health of members, contracts, shared partners, cards, check-ins and audit logs; keep personal details out of release notes.
- [ ] Prepare reviewed rollback SQL for **function/trigger behaviour** and a code-deployment rollback. Additive columns and existing historical audit entries should not be destructively rolled back.
- [ ] Irreversible permanent deletion is not recoverable through a UI rollback; if ever enabled, it requires separate explicit deletion policy, backups, and an incident response plan. Do not invoke it during rollout tests.

## 4. Migration review and controlled sequencing

- [ ] Identify missing Production prerequisites and apply only reviewed, ordered migrations with an approved release operator and separate Production authorisation. Relevant feature artifacts:
  - `supabase/migrations/20260923_130000_super_admin_member_cancellation.sql`
  - `supabase/migrations/20260923_140000_super_admin_couples_cancellation.sql`
  - `supabase/migrations/20260923_150000_couples_immediate_cancellation_audit.sql`
  - `supabase/migrations/20260923_160000_super_admin_member_archive_restore.sql`
  - `supabase/migrations/20260923_170000_super_admin_member_guarded_delete.sql`
  - `supabase/migrations/20260923_180000_archived_member_access_guard.sql`
  - `supabase/migrations/20260923_190000_archived_member_trigger_privileges.sql`
  - `supabase/migrations/20260923_200000_individual_immediate_cancellation_audit.sql`
- [ ] Include any earlier member profile, date, gym, enrollment and membership schema prerequisites determined from actual Production schema and migration history. Do not blindly replay an already-applied migration.
- [ ] Inspect grants, SECURITY DEFINER search paths, Super Admin identity checks, the explicit service-role-only execution restrictions, RLS and trigger activation. Never expose service-role credentials in the browser.
- [ ] Run approved read-only post-migration checks; run mutating smoke tests exclusively in isolated TEST or inside verified rollback-only transactions, not on real Production members.

## 5. Functional and access acceptance criteria

- [ ] Super Admin alone can see and invoke Archive, Restore, Delete assessment and guarded Delete API actions; ordinary Staff Portal users get 403 for every direct endpoint.
- [ ] Archived members disappear from staff browse, exact-number/card and fuzzy searches, while the separate Super Admin Archive can locate them. Archive blocks app login, membership-card access, barcode/NFC entry and check-ins, including already-signed-in sessions; confirm database guards for direct writes separately.
- [ ] Restoring an archived record does not revive an effective cancellation, automatically renew an expired contract, change payment/application snapshots or alter a linked couples contract.
- [ ] Active couples contracts cannot be archived one partner at a time; joint cancellation affects both partners and the shared contract atomically.
- [ ] Individual cancellation: same-day becomes inactive and audits `member.membership_cancellation.immediate`; future-dated stays active until the effective date and audits `schedule`; future cancellation withdrawal audits `withdraw`. Verify Malta-local effective-date boundaries.
- [ ] Joint couples cancellation: same-day audits `member.couples_cancellation.immediate` for both; future schedule and withdrawal produce separate per-partner audit entries. Failed or stale requests change neither partner.
- [ ] Guarded Delete displays a dependency assessment, requires exact member-number confirmation, denies any linked/retained history, and leaves no member row only for an eligible unused test profile. Assess external media/storage before claiming complete erasure.
- [ ] Retain old historical cancellation audit entries as written. Past immediate TEST actions may have the older `schedule` label; interpret historic events by their stored effective date rather than rewriting audit history.
- [ ] Regression-test Staff Portal reception, enrollment/renewal, normal member search, card scanning, photo warning, member app, bar and existing workflows with their original permissions and expected UI.

## 6. Deployment, monitoring and rollback

- [ ] Obtain **separate explicit approval** before applying any Production migration, merging into `main`, triggering a Production Vercel build, changing Production environment variables or enabling deletion for real members.
- [ ] Deploy exactly the reviewed commit with verified Production-only Supabase URLs and credentials. Keep TEST and Production Preview domain/environment isolation and fail-closed protections.
- [ ] Observe runtime errors, latency, audit action counts, scanner deny/grant rates, renewal issues and member search results during the approved observation window, without exposing personal data.
- [ ] If application behaviour fails, revert to the preserved known-good Production Vercel deployment. If a DB function or trigger is implicated, execute only the separately reviewed compensating SQL; validate compatibility between older app and additive DB changes. Never delete historical audit events or bulk-update membership statuses to 'repair' a rollout.
- [ ] Record final checks and release sign-off. Archive/Restore/guarded Delete can remain TEST-only even if some other feature modules are released.

**Current TEST checkpoint (2026-09-23):** TEST individual immediate-cancellation audit RPC was updated and checked; transactional synthetic tests for immediate/scheduled/withdrawn actions rolled back. Original three fictional cancellation members remain inactive; guarded Delete blocked their linked history. No production change is implied by this checklist.
