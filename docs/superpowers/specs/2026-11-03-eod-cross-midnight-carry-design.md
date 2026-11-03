# EOD Cross-Midnight Carry Design

## Intent
End of Day is a financial shift close, not a calendar-midnight reset. Once an EOD is submitted, all subsequent activity remains open and carries forward until the next EOD submission, even when midnight passes.

## Locked behaviour
- Midnight does not clear or restart EOD figures.
- The previous successful EOD `shift_ended_at` is the lower bound of the next open financial shift.
- The next EOD submission time is the upper bound.
- New memberships, renewals, voucher reimbursements, Bar sales, expenses, gross and final total keep their existing calculation rules.
- `business_date` remains useful for labelling/grouping the submitted report, but must not exclude activity that occurred after the previous EOD on the prior calendar date.
- The live Bar working sheet remains the same open sheet across midnight and is cleared only by a successful EOD submission.
- If a gym has never submitted EOD before, the existing current-Malta-day start behaviour remains the initial fallback.

## Approach
Keep the existing `bgm_submit_end_of_day` calculation path and shift snapshot tables. Change only the window boundaries: find the latest EOD for the gym across all dates, then include activity after that timestamp through the current submission. Preserve per-calendar-day shift numbering for Super Admin history.

For Bar, stop resolving the live working row by `business_date`; use the latest live daily-sheet row for the gym. Successful EOD still snapshots its items and clears that same working row atomically.

## Non-goals
- No changes to membership prices, payment methods or voucher mathematics.
- No automatic EOD submission.
- No changes to printed EOD layout or Super Admin financial categories.
- No Production data mutation until TEST verification is complete and separately approved.
