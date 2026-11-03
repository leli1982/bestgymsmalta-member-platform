import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOfflineRosterMember,
  offlineRosterMemberMayMatterAtGym,
} from "../lib/offlineAccessCore.ts";

const base = {
  accessScope: "single_gym",
  accessGymId: "gym-a",
  accessGymName: "Gym A",
  pendingAccessScope: "single_gym",
  pendingAccessGymId: "gym-b",
  pendingAccessGymName: "Gym B",
  pendingAccessEffectiveDate: "2026-11-04",
  membershipExpiry: "2027-01-01",
  cancellationEffectiveDate: null,
};

test("offline single-gym target switches locally on the effective Malta date without resync", () => {
  assert.equal(evaluateOfflineRosterMember(base, "gym-b", "2026-11-03").granted, false);
  assert.equal(evaluateOfflineRosterMember(base, "gym-b", "2026-11-04").granted, true);
  assert.equal(evaluateOfflineRosterMember(base, "gym-a", "2026-11-03").granted, true);
  assert.equal(evaluateOfflineRosterMember(base, "gym-a", "2026-11-04").granted, false);
});

test("future Single Gym to All Access is cached at the destination gym before it becomes effective", () => {
  const member = {
    ...base,
    pendingAccessScope: "network",
    pendingAccessGymId: null,
    pendingAccessGymName: null,
  };
  assert.equal(offlineRosterMemberMayMatterAtGym(member, "gym-b"), true);
  assert.equal(evaluateOfflineRosterMember(member, "gym-b", "2026-11-03").granted, false);
  assert.equal(evaluateOfflineRosterMember(member, "gym-b", "2026-11-04").granted, true);
});

test("future All Access to Single Gym is denied at other gyms from its effective date", () => {
  const member = {
    ...base,
    accessScope: "network",
    accessGymId: null,
    accessGymName: null,
    pendingAccessScope: "single_gym",
    pendingAccessGymId: "gym-a",
    pendingAccessGymName: "Gym A",
  };
  assert.equal(evaluateOfflineRosterMember(member, "gym-b", "2026-11-03").granted, true);
  assert.equal(evaluateOfflineRosterMember(member, "gym-b", "2026-11-04").result, "restricted_gym");
});

test("offline cached access still enforces expiry and effective cancellation", () => {
  assert.equal(
    evaluateOfflineRosterMember({ ...base, membershipExpiry: "2026-11-02" }, "gym-a", "2026-11-03").result,
    "expired",
  );
  assert.equal(
    evaluateOfflineRosterMember({ ...base, cancellationEffectiveDate: "2026-11-03" }, "gym-a", "2026-11-03").result,
    "inactive",
  );
});
