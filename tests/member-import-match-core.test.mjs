import assert from "node:assert/strict";
import test from "node:test";
import { classifyMemberImportRow } from "../lib/memberImportMatchCore.ts";

test("active card wins when it belongs to that member", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "0012345", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [{ id: "m1", cardBarcode: "0012345", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("card attached to materially different person is conflict", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "0012345", gym: "Marsa", pkCustomer: "999", customerName: "Mary Vella", email: "mary@example.com" },
    byCardBarcode: [{ id: "m1", cardBarcode: "0012345", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
    legacyCandidates: [],
  });
  assert.equal(result.action, "conflict");
});

test("unused incoming card can be linked to a known legacy member without a card", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "0099999", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [],
    legacyCandidates: [{ id: "m1", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("unused incoming card cannot silently replace a known member active card", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "0099999", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [],
    legacyCandidates: [{ id: "m1", cardBarcode: "0012345", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "conflict");
  assert.equal(result.matchedMemberId, "m1");
});

test("card owner and conflicting legacy owner is conflict", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "0012345", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [{ id: "m2", cardBarcode: "0012345", legacyGym: "Marsa", legacyPkCustomer: "1", fullName: "Other Person", email: "other@example.com" }],
    legacyCandidates: [{ id: "m1", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "conflict");
});

test("blank card with one strong legacy match keeps existing member", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [],
    legacyCandidates: [{ id: "m1", cardBarcode: "0012345", legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" }],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("ambiguous duplicate legacy key is conflict rather than guessed", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "" },
    byCardBarcode: [],
    legacyCandidates: [
      { id: "m1", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
      { id: "m2", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "" },
    ],
  });
  assert.equal(result.action, "conflict");
});

test("duplicate legacy key can be reduced by exact nonblank email", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "", gym: "QROQQ", pkCustomer: "12", customerName: "John Borg", email: "john@example.com" },
    byCardBarcode: [],
    legacyCandidates: [
      { id: "m1", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "john@example.com" },
      { id: "m2", cardBarcode: null, legacyGym: "QROQQ", legacyPkCustomer: "12", fullName: "John Borg", email: "other@example.com" },
    ],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});

test("no card or legacy match is new", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "", gym: "Marsa", pkCustomer: "500", customerName: "New Person", email: "" },
    byCardBarcode: [],
    legacyCandidates: [],
  });
  assert.equal(result.action, "new");
  assert.equal(result.matchedMemberId, null);
});

test("blank name and company is invalid rather than fabricated", () => {
  const result = classifyMemberImportRow({
    incoming: { cardBarcode: "", gym: "Marsa", pkCustomer: "500", customerName: "", companyName: "", email: "" },
    byCardBarcode: [],
    legacyCandidates: [],
  });
  assert.equal(result.action, "invalid");
});

const completeIncoming = {
  cardBarcode: "0012345",
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
  cardBarcode: "0012345",
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

test("unchanged requires all imported profile fields and current card to match", () => {
  const result = classifyMemberImportRow({
    incoming: completeIncoming,
    byCardBarcode: [completeExisting],
    legacyCandidates: [],
  });
  assert.equal(result.action, "unchanged");
  assert.equal(result.matchedMemberId, "m1");
});

test("profile changes such as address are classified as update", () => {
  const result = classifyMemberImportRow({
    incoming: { ...completeIncoming, address1: "2 New Street" },
    byCardBarcode: [completeExisting],
    legacyCandidates: [],
  });
  assert.equal(result.action, "update");
  assert.equal(result.matchedMemberId, "m1");
});
