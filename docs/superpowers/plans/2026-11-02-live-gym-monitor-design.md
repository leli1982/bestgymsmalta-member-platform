# Live Gym Monitor Design

## Intent
Give Super Admin a fast, read-only remote view of one gym during live testing without changing scanner, membership, Bar, EOD, or other write workflows.

## Scope
- Super Admin only.
- Select one gym.
- Auto-refresh every 5 seconds with a visible last-updated time and manual Refresh button.
- Show today's accepted check-ins, rejected scans, membership/audit actions, Bar total/activity, and recent chronological activity.
- Activity comes only from existing Production records: `bgm_access_scans`, `bgm_member_checkins`, `bgm_audit_trail_read`, and `bgm_operational_orders`.
- No screen capture, keystroke monitoring, remote control, new database tables, realtime subscriptions, or changes to write paths.

## Approach
Use one Super Admin-only API endpoint that aggregates existing records for the selected gym and Malta business day. The client polls it every 5 seconds. This is preferred over Supabase Realtime for the impromptu test because it is smaller, read-only, easier to verify, and does not require publication/RLS changes.

## Safety
The API must call `requireSuperAdmin`, require a valid gym ID, use the existing server-only Supabase admin client, return `private, no-store`, cap the feed, and never expose card UIDs or credential values.
