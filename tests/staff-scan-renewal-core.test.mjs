import test from "node:test";
import assert from "node:assert/strict";
import { getGrantedRenewalDaysRemaining } from "../lib/staffScanRenewalCore.ts";

test("Seven-day renewal warning includes exactly expiry day and the seven days before", () => {
  const today = "2026-11-18";
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-25", today), 7);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-24", today), 6);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-19", today), 1);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-18", today), 0);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-26", today), null);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-11-17", today), null);
});

test("Display-only warning never appears for access-denied scans or missing dates", () => {
  for (const expiry of ["2026-11-18","2026-11-24","2026-11-25"]) {
    assert.equal(getGrantedRenewalDaysRemaining(false, expiry, "2026-11-18"), null);
  }
  for (const expiry of [null, undefined, "", "invalid", "2026-02-30"]) {
    assert.equal(getGrantedRenewalDaysRemaining(true, expiry, "2026-11-18"), null);
  }
});

test("Comparisons use calendar days, not local UTC offsets or daylight-saving seconds", () => {
  assert.equal(getGrantedRenewalDaysRemaining(true, "2027-01-02", "2026-12-26"), 7);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-03-29", "2026-03-28"), 1);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2026-10-25", "2026-10-24"), 1);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2028-02-29", "2028-02-22"), 7);
  assert.equal(getGrantedRenewalDaysRemaining(true, "2028-03-01", "2028-02-29"), 1);
});
