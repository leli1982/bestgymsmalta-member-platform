# Staff Dashboard & Reception — Manual Card Entry Implementation Addendum

> This addendum modifies Task 6 of `docs/superpowers/plans/2026-09-15-staff-dashboard-reception.md` and must be read with that plan.

**Goal:** Add a scanner-malfunction fallback without adding another primary workflow action.

## Task 6 amendment: SCAN CARD

The **SCAN CARD** action remains one of the approved three primary actions. Entering Scan Card mode must provide two input paths:

- primary: hardware scanner input, focused automatically;
- fallback: **Enter card number manually**.

The fallback reveals one card-number field plus **Assign Card**. Do not require double entry.

Both input paths must call the same existing endpoint:

```ts
POST /api/system/members/card/assign
{
  applicationMemberId: string,
  barcode: string
}
```

No `inputMethod` flag is required for business logic; scanner and manual entry intentionally share the exact validation path. Existing barcode normalization, duplicate/reservation checks, application ownership rules and audit behaviour remain authoritative.

### Additional TDD contract

Add to `tests/staff-dashboard-ui-contract.test.mjs`:

```js
test("scan-card mode includes manual-entry fallback without adding a fourth primary action", () => {
  assert.match(modal, /Enter card number manually/);
  assert.match(modal, /Assign Card/);
  assert.match(modal, /\/api\/system\/members\/card\/assign/);
  assert.doesNotMatch(modal, /MANUAL CARD[^\n]*PAYMENT RECEIVED[^\n]*PRINT FORM/i);
});
```

### Browser verification amendment

In `tests/browser/staff-dashboard.mjs`, verify both card-entry paths with the same mocked endpoint:

1. Open an application and click **SCAN CARD**.
2. Confirm scanner input receives focus.
3. Switch to **Enter card number manually**.
4. Enter a synthetic unused card number such as `TESTCARD1001`.
5. Click **Assign Card**.
6. Assert the request body is exactly `{ applicationMemberId: <fixture participant id>, barcode: "TESTCARD1001" }`.
7. Return success from the mocked existing card-assignment endpoint.
8. Verify green **CARD ASSIGNED ✓** state appears.
9. In a second mocked response return HTTP 409 for a conflicting manual card; verify the modal stays open and Payment Received remains disabled.

### Visual rule

Manual entry is secondary within Scan Card mode. It must not compete visually with the three approved primary actions: **SCAN CARD**, **PAYMENT RECEIVED**, **PRINT FORM**.