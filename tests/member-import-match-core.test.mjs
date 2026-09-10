import assert from "node:assert/strict";
import test from "node:test";
import { classifyMemberImportRow } from "../lib/memberImportMatchCore.ts";

test("explicit permanent number wins when it belongs to that member", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000042", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("explicit number attached to materially different person is conflict", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000042", gym: "Marsa", pkCustomer: "999", customerName: "Mary Vella", email: "mary@example.com" },
    byMembershipNumber: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "conflict");
});

test("blank number with one strong legacy match keeps existing member", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [],
    legacyCandidates: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("ambiguous duplicate legacy key is conflict rather than guessed", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "" },
    byMembershipNumber: [],
    legacyCandidates: [
      { id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
      { id: "m2", memberNumber: "BGM0000043", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
    ],
  });
  assert.equal(result.action, "conflict");
});

test("duplicate legacy key can be reduced by exact nonblank email", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [],
    legacyCandidates: [
      { id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" },
      { id: "m2", memberNumber: "BGM0000043", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "other@example.com" },
    ],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("no permanent or legacy match is new", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "Marsa", pkCustomer: "500", customerName: "New Person", email: "" },
    byMembershipNumber: [],
    legacyCandidates: [],
  });
  assert.equal(result.action, "new");
  assert.equal(result.matchedMemberId, null);
});

test("blank name and company is invalid rather than fabricated", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "", gym: "Marsa", pkCustomer: "500", customerName: "", companyName: "", email: "" },
    byMembershipNumber: [],
    legacyCandidates: [],
  });
  assert.equal(result.action, "invalid");
});

test("unchanged is returned when compared fields already match", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000042", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com", expiryDate: "2027-09-03", status: "active" },
    byMembershipNumber: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com", membershipExpiry: "2027-09-03", status: "active" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "unchanged");
  assert.equal(result.matchedMemberId, "m1");
});
