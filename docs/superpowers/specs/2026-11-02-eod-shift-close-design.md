# Shift-based End of Day Design

## Goal
Allow gym staff to submit End of Day after every staff shift, not only once per calendar day, without double-counting any membership, renewal, voucher reimbursement or Bar sale.

## Required behaviour
- Each successful EOD submission is an immutable shift report for one gym and Malta business date.
- A gym may submit multiple shift reports on the same date.
- Shift 1 starts at Malta midnight. Each later shift starts at the prior shift's end timestamp.
- Membership/renewal rows belong to a shift using the payment timestamp and are counted once only.
- Bar uses the current live sheet as the shift snapshot. After successful EOD, its items and total reset to zero and remain editable for the next shift.
- Expenses belong only to the shift being submitted.
- Each successful shift is visible to Super Admin and still triggers the existing hard-copy print behaviour.
- Super Admin shows each shift separately plus a combined daily total per gym/date.
- Existing historical one-per-day EOD reports remain valid as Shift 1 historical records.
- Submission remains atomic under the existing per-gym/date advisory lock.

## Safety
- Do not alter membership, renewal or check-in records.
- Do not delete historical EOD snapshots.
- Do not allow a failed submission to clear the Bar sheet.
- Preserve existing staff permissions, audit logging and Super Admin report access.