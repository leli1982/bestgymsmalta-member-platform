import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";

test("active current member is granted", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({
      member: { status: "active", membershipExpiry: "2027-09-09" },
      today: "2026-09-09",
    }),
    { result: "granted", granted: true }
  );
});

test("expired member is denied", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({
      member: { status: "active", membershipExpiry: "2026-09-08" },
      today: "2026-09-09",
    }),
    { result: "expired", granted: false }
  );
});

test("inactive member is denied", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({
      member: { status: "inactive", membershipExpiry: "2027-09-09" },
      today: "2026-09-09",
    }),
    { result: "inactive", granted: false }
  );
});

test("unknown member is denied", () => {
  assert.deepEqual(
    evaluateBarcodeAccess({ member: null, today: "2026-09-09" }),
    { result: "unknown_member", granted: false }
  );
});
