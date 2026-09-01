import test from "node:test";
import assert from "node:assert/strict";
import { evaluateNfcAccess } from "../lib/nfcAccessCore.ts";

const activeCard = { status: "active" };
const activeMember = { status: "active", membershipExpiry: "2026-12-31" };

test("grants active card with active unexpired member", () => {
  assert.deepEqual(
    evaluateNfcAccess({ card: activeCard, member: activeMember, today: "2026-09-01" }),
    { result: "granted", granted: true }
  );
});

test("rejects unknown cards", () => {
  assert.deepEqual(
    evaluateNfcAccess({ card: null, member: null, today: "2026-09-01" }),
    { result: "unknown_card", granted: false }
  );
});

test("rejects disabled or replaced cards", () => {
  assert.deepEqual(
    evaluateNfcAccess({ card: { status: "disabled" }, member: activeMember, today: "2026-09-01" }),
    { result: "disabled_card", granted: false }
  );
  assert.deepEqual(
    evaluateNfcAccess({ card: { status: "replaced" }, member: activeMember, today: "2026-09-01" }),
    { result: "disabled_card", granted: false }
  );
});

test("rejects inactive members", () => {
  assert.deepEqual(
    evaluateNfcAccess({ card: activeCard, member: { status: "inactive", membershipExpiry: "2026-12-31" }, today: "2026-09-01" }),
    { result: "inactive", granted: false }
  );
});

test("rejects expired members but accepts expiry date itself", () => {
  assert.deepEqual(
    evaluateNfcAccess({ card: activeCard, member: { status: "active", membershipExpiry: "2026-08-31" }, today: "2026-09-01" }),
    { result: "expired", granted: false }
  );
  assert.deepEqual(
    evaluateNfcAccess({ card: activeCard, member: { status: "active", membershipExpiry: "2026-09-01" }, today: "2026-09-01" }),
    { result: "granted", granted: true }
  );
});
