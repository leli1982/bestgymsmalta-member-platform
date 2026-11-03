import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";
import { evaluateNfcAccess } from "../lib/nfcAccessCore.ts";

const futureSingleGym = {
  status: "active",
  membershipExpiry: "2027-01-31",
  accessScope: "network",
  accessGymId: null,
  pendingAccessScope: "single_gym",
  pendingAccessGymId: "bgm-neptunes",
  pendingAccessEffectiveDate: "2026-11-10",
};

test("future All Access to Single Gym renewal keeps network access before effective date", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: futureSingleGym, today: "2026-11-09", gymId: "bgm-marsa" }),
    { result: "granted", granted: true },
  );
});

test("future All Access to Single Gym renewal restricts access on effective date", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: futureSingleGym, today: "2026-11-10", gymId: "bgm-marsa" }),
    { result: "restricted_gym", granted: false },
  );
  assert.deepEqual(
    evaluateBarcodeAccess({ member: futureSingleGym, today: "2026-11-10", gymId: "bgm-neptunes" }),
    { result: "granted", granted: true },
  );
});

test("future Single Gym to All Access renewal becomes network access on effective date", () => {
  const member = {
    status: "active",
    membershipExpiry: "2027-01-31",
    accessScope: "single_gym",
    accessGymId: "bgm-neptunes",
    pendingAccessScope: "network",
    pendingAccessGymId: null,
    pendingAccessEffectiveDate: "2026-11-10",
  };

  assert.deepEqual(
    evaluateNfcAccess({ card: { status: "active" }, member, today: "2026-11-09", gymId: "bgm-marsa" }),
    { result: "restricted_gym", granted: false },
  );
  assert.deepEqual(
    evaluateNfcAccess({ card: { status: "active" }, member, today: "2026-11-10", gymId: "bgm-marsa" }),
    { result: "granted", granted: true },
  );
});
