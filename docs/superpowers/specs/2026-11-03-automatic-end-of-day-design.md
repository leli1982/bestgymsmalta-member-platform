# Automatic End of Day Fallback Design

## Intent
Provide a server-side End of Day fallback so every active gym gets a final EOD close when Staff do not submit during the required late-night window.

## Locked rule
- Timezone: Europe/Malta.
- Qualifying Staff-submission window: 22:30:00 inclusive to 23:46:00 exclusive.
- At 23:46 Malta time, automatically submit only for active gyms with no EOD report submitted in that window.
- Automatic reports are clearly marked `Automatic — System Submission` and source `system`.
- Manual Staff EOD remains unchanged and source `staff`.
- Reuse existing shift sequencing, payment filtering, Bar snapshot/reset, totals and audit logic.
- Duplicate cron runs and Staff/cron races must not create duplicate automatic closes.

## Approach
Use Vercel Cron with one schedule covering both Malta UTC offsets (`46 21,22 * * *`). The cron route authenticates with `CRON_SECRET` and acts only when Malta local time is exactly 23:46.

At database level, add `submission_source` to EOD reports and a service-only automatic EOD RPC. The RPC loops active gyms, acquires the same per-gym/date advisory lock used by normal EOD submission, rechecks whether a report exists in the 22:30–23:46 window, then reuses the existing EOD submit path with system source and no expenses.

## Non-goals
- No email-specific workflow.
- No change to Staff manual EOD UX or calculations.
- No automatic close for inactive/coming-soon gyms.
- No automatic close before 23:46 Malta time.
