# Staff Manual + Live Help Refresh Design

**Date:** 2026-11-03

## Intent
Keep the Full Staff Manual and the floating Staff Help Centre aligned with the current Production Staff Portal after Single Gym access and cross-midnight End of Day changes.

## Approach
Use the existing shared `lib/staffHelpContent.ts` source of truth so one wording change updates both the Full Staff Manual and the live Help popup. Do not create a second manual data source.

Also correct Staff-facing Bar and End of Day copy where the UI still says “today”, because the live financial shift now continues across midnight until a successful EOD submission.

## Required content updates
- Explain **All Access** versus **Single Gym** in simple staff language.
- New membership guidance: choose access first when Single Gym is available, then membership type/duration.
- Renewal guidance: current access is preselected; only change it deliberately when requested.
- Scanner guidance: Single Gym members are denied at other gyms; offline cached decisions remain access decisions but do not create a live check-in.
- Bar guidance: the live sheet carries across midnight and is cleared only after successful EOD submission.
- EOD guidance: figures cover the open period since the previous successful EOD, not the calendar day; midnight resets nothing.
- Mention the post-EOD hard-copy print flow.
- Punch Clock remains excluded until the fingerprint hardware workflow is released.

## UI copy alignment
- Replace misleading “Bar total for today” / “live daily sheet” wording with “since last End of Day” / “open Bar sheet”.
- Replace EOD “today’s saved activity” wording with wording based on the previous successful EOD.
- Keep calculations and behaviour unchanged; this refresh is copy/help only.

## Non-goals
- No change to EOD calculations, membership pricing, scanner rules, Bar persistence, or database logic.
- No Punch Clock instructions yet.
- No Super Admin help changes in this task.
