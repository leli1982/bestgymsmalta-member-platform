# App Adoption Analytics Design

## Goal
Add a read-only App Adoption report under Management → Statistics & Analytics so Super Admin can see how many members activate the BGM member app on any day.

## Scope
- New Statistics & Analytics option: **App Adoption**.
- Headline KPIs: total app-enrolled members, adoption rate among currently active members, activations today, this week, this month, and currently active members not yet enrolled.
- Daily activation trend for a selectable date range, defaulting to the last 30 Malta calendar days.
- Keep `bgm_members.app_enrolled` as the adoption flag and add a nullable `bgm_members.app_enrolled_at` timestamp for the precise first app activation.
- Registration writes `app_enrolled_at` at the same time it first sets `app_enrolled = true`.
- No scanner, Bar, EOD, membership or other operational flow changes.

## Data Rules
- A precisely dated app activation is a member row with `app_enrolled = true` and a non-null `app_enrolled_at`.
- Existing app-enrolled members from before this tracking change remain counted in total/adoption KPIs but are left with `app_enrolled_at = null`; their historical activation date is not guessed from membership enrollment, last login or update timestamps.
- Daily activation counts convert `app_enrolled_at` to the Europe/Malta calendar date.
- Currently active members follow the same business meaning used elsewhere: status active, not archived, membership not expired (null remains allowed under existing business rules), and no cancellation effective on/before today.
- Adoption rate = currently active + app-enrolled / currently active members.
- Date range validation and day boundaries use existing Malta calendar-date helpers.

## UI
- Add an **App Adoption** tile in the Business analytics group.
- Dedicated read-only panel with date inputs, KPI cards and a daily activation chart rendered in the project’s existing analytics style.
- Show zero days in the selected range so quiet days remain visible.
- If legacy app enrollments predate precise tracking, show their count clearly rather than assigning invented dates.

## Safety
- Super Admin authentication required.
- One additive nullable database column only; no destructive migration or backfill.
- Analytics endpoint is read-only.
- Existing analytics and operational flows must remain unchanged.
