import assert from "node:assert/strict";
import test from "node:test";
import {
  couplesAgeEligibilityError,
  isUnder18On,
  isUnder16On,
  normalizeIdentityDocument,
  participantCountForType,
  requiredDocumentMessage,
  withCouplesSharedAddress,
  validateRegistrationParticipant,
} from "../lib/membershipRegistrationCore.ts";
import { calculateMembershipExpiry } from "../lib/membershipEnrollmentCore.ts";

function adultParticipant(overrides = {}) {
  return {
    firstName: "Alex",
    lastName: "Mifsud",
    idNumber: "123456M",
    dateOfBirth: "1994-05-16",
    addressLine1: "12 Main Street",
    addressLine2: "",
    town: "Birkirkara",
    postcode: "BKR 1000",
    phone: "79001234",
    email: "alex@example.com",
    nextOfKin: "Maria Mifsud — 79004567",
    ...overrides,
  };
}

test("identity documents are normalized consistently for duplicate matching", () => {
  assert.equal(normalizeIdentityDocument("  123 456 m "), "123456M");
  assert.equal(normalizeIdentityDocument("PA-12 34"), "PA1234");
  assert.equal(normalizeIdentityDocument("   "), "");
});

test("minor status is locked to the application submission calendar date", () => {
  assert.equal(isUnder18On("2008-09-17", "2026-09-16"), true);
  assert.equal(isUnder18On("2008-09-16", "2026-09-16"), false);
  assert.equal(isUnder18On("2000-01-01", "2026-09-16"), false);
});

test("guardian declaration is only for applicants under 16, including on their birthday", () => {
  assert.equal(isUnder16On("2010-09-17", "2026-09-16"), true);
  assert.equal(isUnder16On("2010-09-16", "2026-09-16"), false);
  assert.equal(isUnder16On("2009-09-16", "2026-09-16"), false);
  // A 16-year-old still has the independent under-18 guardian detail checks.
  assert.equal(isUnder18On("2010-09-16", "2026-09-16"), true);
});

test("invalid calendar dates are rejected instead of silently normalized", () => {
  assert.throws(() => isUnder18On("2008-02-30", "2026-09-16"), /valid.*date/i);
  assert.throws(() => isUnder18On("2008-02-20", "2026-13-01"), /valid.*date/i);
});

test("Couples requires two adults, including on the eighteenth birthday", () => {
  assert.match(
    couplesAgeEligibilityError("couples", "2008-09-26", "2026-09-25"),
    /both applicants.*at least 18/i
  );
  assert.equal(couplesAgeEligibilityError("couples", "2008-09-25", "2026-09-25"), null);
  assert.equal(couplesAgeEligibilityError("couples", "1990-03-03", "2026-09-25"), null);
  assert.equal(couplesAgeEligibilityError("single", "2010-02-02", "2026-09-25"), null);
  assert.equal(couplesAgeEligibilityError("student", "2010-02-02", "2026-09-25"), null);
});

test("membership type controls participant count", () => {
  assert.equal(participantCountForType("single"), 1);
  assert.equal(participantCountForType("student"), 1);
  assert.equal(participantCountForType("couples"), 2);
});

test("document readiness messages match the approved membership requirements", () => {
  assert.deepEqual(requiredDocumentMessage("single"), ["Valid ID card or passport."]);
  assert.deepEqual(requiredDocumentMessage("student"), [
    "Valid ID card or passport.",
    "Valid student card or supporting student document.",
  ]);
  assert.deepEqual(requiredDocumentMessage("couples"), [
    "Valid ID cards or passports for both applicants.",
    "ID or supporting documents (such as a utility bill) confirming both applicants live at the same address. Reception verifies these visually.",
  ]);
});

test("Couples enter one address, copied to both distinct participants without changing identity", () => {
  const first = adultParticipant({
    idNumber: "111111M",
    addressLine1: "Shared Street 12",
    addressLine2: "Flat 3",
    town: "Mosta",
    postcode: "MST 0001",
  });
  const second = adultParticipant({
    firstName: "Robin",
    idNumber: "222222M",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
  });
  const originals = [first, second];
  const shared = withCouplesSharedAddress("couples", originals);
  assert.equal(shared.length, 2);
  assert.deepEqual(shared[1], {
    ...second,
    addressLine1: first.addressLine1,
    addressLine2: first.addressLine2,
    town: first.town,
    postcode: first.postcode,
  });
  assert.equal(shared[0].idNumber, "111111M");
  assert.equal(shared[1].idNumber, "222222M");
  assert.equal(originals[1].addressLine1, "");
  assert.deepEqual(withCouplesSharedAddress("single", originals), originals);
  assert.deepEqual(withCouplesSharedAddress("student", originals), originals);
});

test("under-18 participants require complete guardian details", () => {
  const errors = validateRegistrationParticipant(
    adultParticipant({ dateOfBirth: "2010-01-10" }),
    "2026-09-16"
  );
  assert.ok(errors.some((message) => /guardian/i.test(message)));

  assert.deepEqual(
    validateRegistrationParticipant(
      adultParticipant({
        dateOfBirth: "2010-01-10",
        guardian: {
          fullName: "Maria Mifsud",
          idNumber: "654321M",
          relationship: "Mother",
          mobile: "79004567",
          email: "maria@example.com",
          address: "12 Main Street, Birkirkara",
        },
      }),
      "2026-09-16"
    ),
    []
  );
});

test("adult participants do not require guardian details", () => {
  assert.deepEqual(validateRegistrationParticipant(adultParticipant(), "2026-09-16"), []);
});

test("canonical membership expiry matches the established BGM duration rules", () => {
  assert.equal(calculateMembershipExpiry("2026-09-16", "1_week"), "2026-09-23");
  assert.equal(calculateMembershipExpiry("2026-09-16", "2_weeks"), "2026-09-30");
  assert.equal(calculateMembershipExpiry("2026-09-16", "1_month"), "2026-10-16");
  assert.equal(calculateMembershipExpiry("2026-09-16", "3_months"), "2026-12-16");
  assert.equal(calculateMembershipExpiry("2026-09-16", "6_months"), "2027-03-16");
  assert.equal(calculateMembershipExpiry("2026-09-16", "1_year"), "2027-09-16");
});
