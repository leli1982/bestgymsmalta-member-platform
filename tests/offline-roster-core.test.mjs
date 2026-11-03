import test from "node:test";
import assert from "node:assert/strict";
import {
  toOfflineRosterMember,
  hashOfflineRoster,
} from "../lib/offlineRosterCore.ts";

test("offline roster exposes cached authorization state without private contact fields", () => {
  const row = {
    member_number: "BGM001",
    full_name: "Maria Borg",
    access_scope: "network",
    pending_access_scope: "single_gym",
    pending_access_gym_id: "bgm-neptunes",
    pending_access_gym_name: "Neptunes Fitness",
    pending_access_effective_date: "2026-11-04",
    membership_expiry: "2026-12-31",
    cancellation_effective_date: null,
    card_numbers: [" M112232 ", "M112232", "K778899"],
    email: "private@example.com",
    phone: "99999999",
  };

  assert.deepEqual(toOfflineRosterMember(row), {
    memberNumber: "BGM001",
    fullName: "Maria Borg",
    accessScope: "network",
    accessGymId: null,
    accessGymName: null,
    pendingAccessScope: "single_gym",
    pendingAccessGymId: "bgm-neptunes",
    pendingAccessGymName: "Neptunes Fitness",
    pendingAccessEffectiveDate: "2026-11-04",
    membershipExpiry: "2026-12-31",
    cancellationEffectiveDate: null,
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
  const base = {
    accessGymId: null,
    accessGymName: null,
    pendingAccessScope: null,
    pendingAccessGymId: null,
    pendingAccessGymName: null,
    pendingAccessEffectiveDate: null,
    membershipExpiry: null,
    cancellationEffectiveDate: null,
  };
  const roster = [
    { ...base, memberNumber: "BGM001", fullName: "Maria Borg", accessScope: "network", cardNumbers: ["M112232"] },
    { ...base, memberNumber: "BGM002", fullName: "John Vella", accessScope: "network", cardNumbers: [] },
  ];

  assert.equal(hashOfflineRoster(roster), hashOfflineRoster(roster));
  assert.notEqual(
    hashOfflineRoster(roster),
    hashOfflineRoster([...roster].reverse())
  );
});