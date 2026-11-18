import test from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_PERSONAL_DETAIL_FIELDS,
  validateStaffPersonalDetails,
} from "../lib/staffMemberPersonalDetailsCore.ts";

const base = () => Object.fromEntries(
  STAFF_PERSONAL_DETAIL_FIELDS.map(key => [key, ""])
);

test("Gym staff can save only approved identity and contact corrections", () => {
  const draft = {
    ...base(), firstName: "Alex", lastName: "Borg",
    idNumber: "A123456", addressLine1: "12 High Street", town: "Mosta",
    mobile: "99999999", email: "alex@example.com",
    nextOfKin: "Jane Borg 99887766",
  };
  const value = validateStaffPersonalDetails(draft);
  assert.equal(value.ok, true);
  if (value.ok) {
    assert.equal(value.profile.nextOfKin, "Jane Borg 99887766");
    assert.equal(value.profile.firstName, "Alex");
  }
});

test("Staff member corrections fail closed for membership or account controls", () => {
  const draft = { ...base(), firstName: "Alex", lastName: "Borg" };
  const sensitive = [
    "membershipExpiry","expiryDate","enrollmentDate","startDate","durationKey",
    "membershipPeriod","membershipPrice","paymentMethod","dateOfBirth",
    "status","enrollmentGymId","accessScope","memberNumber","cardBarcode",
    "gymId","legacyPkCustomer",
  ];
  for (const key of sensitive) {
    const result = validateStaffPersonalDetails({ ...draft, [key]: "2028-01-01" });
    assert.equal(result.ok, false, key + " must be rejected, not ignored");
  }
  const missing = { ...draft };
  delete missing.mobile;
  assert.equal(validateStaffPersonalDetails(missing).ok, false);
  assert.equal(validateStaffPersonalDetails([draft]).ok, false);
  assert.equal(validateStaffPersonalDetails(null).ok, false);
});

test("Staff corrections validate name and email before submission", () => {
  const draft = { ...base(), firstName: "Alex", lastName: "Borg" };
  assert.equal(validateStaffPersonalDetails({ ...draft, firstName: "" }).ok, false);
  assert.equal(validateStaffPersonalDetails({ ...draft, lastName: "" }).ok, false);
  assert.equal(validateStaffPersonalDetails({ ...draft, email: "not-an-email" }).ok, false);
  assert.equal(validateStaffPersonalDetails({ ...draft, email: "alex@example.com" }).ok, true);
  assert.equal(validateStaffPersonalDetails({ ...draft, firstName: "A".repeat(101) }).ok, false);
  assert.equal(validateStaffPersonalDetails({ ...draft, nextOfKin: "N".repeat(501) }).ok, false);
});
