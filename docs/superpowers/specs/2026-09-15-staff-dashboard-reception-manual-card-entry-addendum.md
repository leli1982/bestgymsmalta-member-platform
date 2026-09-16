# Staff Dashboard & Reception — Manual Card Entry Addendum

Date: 2026-09-15
Status: Approved requirement added during implementation planning
Applies to: `docs/superpowers/specs/2026-09-15-staff-dashboard-reception-design.md`

## Requirement

The approved **SCAN CARD** workflow must include a manual fallback for scanner malfunction.

When staff clicks **SCAN CARD**:

1. The normal scanner input is focused first for the physical barcode scanner.
2. A clearly visible but secondary option appears: **Enter card number manually**.
3. Selecting that option reveals a large text/number input and an **Assign Card** confirmation button.
4. Manual card entry is treated exactly like a scanner submission by the server. It must use the same barcode normalization, uniqueness/conflict checks, gym/application authorization, card reservation rules and audit behaviour.
5. The UI must never bypass validation simply because the number was typed manually.
6. If the typed card number is already active, reserved elsewhere, malformed or otherwise invalid, assignment is blocked with the same clear error used for scanner conflicts.
7. On success, the same green **CARD ASSIGNED ✓** state is shown.
8. The manual option is a fallback inside the SCAN CARD flow, not a fourth primary action. The approved three primary actions remain **SCAN CARD**, **PAYMENT RECEIVED**, **PRINT FORM**.

## Usability

The manual-entry fallback should be simple enough for reception staff under pressure. Do not require the number to be typed twice. Staff enters the printed card number once, visually checks it, and presses **Assign Card**. Server validation is authoritative.

## Testing

Browser and contract tests must verify that:

- the fallback is visible after entering Scan Card mode;
- a manually typed card number posts to the same existing card-assignment endpoint and payload shape used by scanner input;
- successful manual assignment produces the same **CARD ASSIGNED ✓** state;
- conflicting/invalid manual numbers remain blocked;
- **PAYMENT RECEIVED** remains disabled until the card is successfully assigned.