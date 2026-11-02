# End of Day Hard Copy Design

**Goal:** After a staff member successfully submits End of Day, keep the existing Super Admin submission unchanged and immediately open the browser print dialog for a hard copy at the gym.

## Scope

- Staff End of Day only: `/staff/end-of-day`.
- Do not change the End of Day API, database function, report persistence, Super Admin review, Bar locking, or calculations.
- Printing happens only after a fresh successful submission is reflected in the UI.
- Opening an End of Day report that was already submitted earlier must not automatically print.
- If submission fails, do not print.
- Print layout hides navigation and interactive controls and uses a white background suitable for paper.

## Approach

Mount a small client-side `EndOfDayPrintBridge` beside the existing `EndOfDayPage`. On mount, record whether the page already contains the submitted-report marker. Observe subsequent DOM changes; when the marker transitions from absent to present, schedule one `window.print()` call. This keeps the submission component and write path untouched.

## Acceptance

1. Existing successful EOD submission still persists and remains available to Super Admin.
2. A successful fresh submission opens the print dialog once.
3. Failed submission does not print.
4. Reopening an already-submitted EOD does not auto-print.
5. Printed output hides links/buttons and uses clean paper styling.
