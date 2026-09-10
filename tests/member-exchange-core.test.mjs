import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_MEMBER_HEADERS,
  MEMBER_EXCHANGE_HEADERS,
  normalizeLegacyValidity,
  statusFromLegacy,
} from "../lib/memberExchangeCore.ts";

test("legacy format is exactly the supplied 15 columns", () => {
  assert.deepEqual(LEGACY_MEMBER_HEADERS, [
    "Gym",
    "pkCustomer",
    "CustomerName",
    "CompanyName",
    "Address1",
    "Address2",
    "Town",
    "PostCode",
    "Gender",
    "TelephoneNo1",
    "TelephoneNo2",
    "Mobile",
    "Email",
    "ExpiryDate1",
    "ValidYN",
  ]);
});

test("exchange format prepends MembershipNumber and changes nothing else", () => {
  assert.deepEqual(MEMBER_EXCHANGE_HEADERS, [
    "MembershipNumber",
    ...LEGACY_MEMBER_HEADERS,
  ]);
});

test("legacy validity normalization accepts only the known labels", () => {
  assert.equal(normalizeLegacyValidity(" valid "), "Valid");
  assert.equal(normalizeLegacyValidity("NOT VALID"), "Not Valid");
  assert.equal(normalizeLegacyValidity("yes"), "");
});

test("legacy status respects validity and an already expired date", () => {
  assert.equal(statusFromLegacy("Valid", "2027-09-09", "2026-09-10"), "active");
  assert.equal(statusFromLegacy("Not Valid", "2027-09-09", "2026-09-10"), "inactive");
  assert.equal(statusFromLegacy("Valid", "2026-09-09", "2026-09-10"), "inactive");
  assert.equal(statusFromLegacy("Valid", "", "2026-09-10"), "active");
});
