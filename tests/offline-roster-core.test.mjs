import test from "node:test";
import assert from "node:assert/strict";
import {
  toOfflineRosterMember,
  hashOfflineRoster,
} from "../lib/offlineRosterCore.ts";

test("offline roster exposes only lookup-safe identity, access scope and physical card fields", () => {
  const row = {
    member_number: "BGM001",
    full_name: "Maria Borg",
    access_scope: "network",
    card_numbers: [" M112232 ", "M112232", "K778899"],
    email: "private@example.com",
    phone: "99999999",
    membership_expiry: "2026-12-31",
  };

  assert.deepEqual(toOfflineRosterMember(row), {
    memberNumber: "BGM001",
    fullName: "Maria Borg",
    accessScope: "network",
    cardNumbers: ["M112232", "K778899"],
  });
});

test("offline roster defaults unknown scope safely to network", () => {
  assert.equal(
    toOfflineRosterMember({ member_number: "BGM003", full_name: "Test Member" }).accessScope,
    "network"
  );
});

test("offline roster hash is stable for the same ordered roster", () => {
  const roster = [
    { memberNumber: "BGM001", fullName: "Maria Borg", accessScope: "network", cardNumbers: ["M112232"] },
    { memberNumber: "BGM002", fullName: "John Vella", accessScope: "network", cardNumbers: [] },
  ];

  assert.equal(hashOfflineRoster(roster), hashOfflineRoster(roster));
  assert.notEqual(
    hashOfflineRoster(roster),
    hashOfflineRoster([...roster].reverse())
  );
});