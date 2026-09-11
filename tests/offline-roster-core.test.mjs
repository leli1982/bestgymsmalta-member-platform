import test from "node:test";
import assert from "node:assert/strict";
import {
  toOfflineRosterMember,
  hashOfflineRoster,
} from "../lib/offlineRosterCore.ts";

test("offline roster exposes only membership number and full name", () => {
  const row = {
    member_number: "BGM001",
    full_name: "Maria Borg",
    email: "private@example.com",
    phone: "99999999",
    membership_expiry: "2026-12-31",
  };

  assert.deepEqual(toOfflineRosterMember(row), {
    memberNumber: "BGM001",
    fullName: "Maria Borg",
  });
});

test("offline roster hash is stable for the same ordered roster", () => {
  const roster = [
    { memberNumber: "BGM001", fullName: "Maria Borg" },
    { memberNumber: "BGM002", fullName: "John Vella" },
  ];

  assert.equal(hashOfflineRoster(roster), hashOfflineRoster(roster));
  assert.notEqual(
    hashOfflineRoster(roster),
    hashOfflineRoster([...roster].reverse())
  );
});
