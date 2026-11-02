# App Adoption Analytics Design

## Goal
Add a read-only App Adoption report under Management → Statistics & Analytics so Super Admin can see how many members activate the BGM member app on any day.

## Scope
- New Statistics & Analytics option: **App Adoption**.
- Headline KPIs: total app-enrolled members, adoption rate among currently active members, activations today, this week, this month, and currently active members not yet enrolled.
- Daily activation trend for a selectable date range, defaulting to the last 30 Malta calendar days.
- Use existing `bgm_members.app_enrolled`, `bgm_members.enrollment_date`, and current membership status fields only.
- Read-only. No schema migration. No enrollment, scanner, Bar, EOD, membership, or member-app behavior changes.

## Data Rules
- An app activation is a member row with `app_enrolled = true` and a non-null `enrollment_date`.
- Daily activation counts are grouped by `enrollment_date` (already a calendar date).
- Currently active members follow the same business meaning used elsewhere: status active, not archived, membership not expired, and no cancellation effective on/before today.
- Adoption rate = currently active + app-enrolled / currently active members.
- Date range validation uses existing Malta calendar-date helpers.

## UI
- Add an **App Adoption** tile in the Business analytics group.
- Dedicated read-only panel with date inputs, KPI cards and a daily activation chart/list rendered in the project’s existing analytics style.
- Show zero days in the selected range so quiet days remain visible.

## Safety
- Super Admin authentication required.
- No database writes or migrations.
- Existing analytics and operational flows must remain unchanged.
