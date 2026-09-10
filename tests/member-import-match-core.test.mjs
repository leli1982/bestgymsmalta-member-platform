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

test("a new explicit number cannot be assigned to a known legacy member", () => {
  const result = classifyMemberImportRow({
    incoming: { membershipNumber: "BGM0000999", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byMembershipNumber: [],
    legacyCandidates: [{ id: "m1", memberNumber: "BGM0000042", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "conflict");
  assert.equal(result.matchedMemberId, "m1");
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

const completeIncoming = {
  membershipNumber: "BGM0000042",
  gym: "QROQQ",
  pkCustomer: "12",
  customerName: "John Borg",
  companyName: "",
  address1: "1 Main Street",
  address2: "",
  town: "Naxxar",
  postcode: "NXR 1000",
  gender: "M",
  telephoneNo1: "",
  telephoneNo2: "99112233",
  mobile: "",
  email: "john@example.com",
  expiryDate: "2027-09-03",
  status: "active",
};

const completeExisting = {
  id: "m1",
  memberNumber: "BGM0000042",
  legacyGym: "QROQQ",
  legacyPkCustomer: "12",
  fullName: "John Borg",
  companyName: "",
  address1: "1 Main Street",
  address2: "",
  town: "Naxxar",
  postcode: "NXR 1000",
  gender: "M",
  telephoneNo1: "",
  telephoneNo2: "99112233",
  mobile: "",
  email: "john@example.com",
  membershipExpiry: "2027-09-03",
  status: "active",
};

test("unchanged requires all imported fields to match", () => {
  const result = classifyMemberImportRow({
    incoming: completeIncoming,
    byMembershipNumber: [completeExisting],
    legacyCandidates: [],
  });
  assert.equal(result.action, "unchanged");
  assert.equal(result.matchedMemberId, "m1");
});

test("profile changes such as address are classified as update", () => {
  const result = classifyMemberImportRow({
    incoming: { ...completeIncoming, address1: "2 New Street" },
    byMembershipNumber: [completeExisting],
    legacyCandidates: [],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});
