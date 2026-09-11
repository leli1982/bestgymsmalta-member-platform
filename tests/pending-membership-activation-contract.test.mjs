import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/staff/PendingMembershipActions.tsx", import.meta.url), "utf8");

test("pending membership action owns the final payment activation step", () => {
  assert.match(source, /Activation Staff Name/);
  assert.match(source, /PAYMENT RECEIVED — ACTIVATE/);
  assert.match(source, /action:\s*"activate"/);
  assert.match(source, /applicationId:\s*application\.id/);
});

test("activation stays blocked until every participant has a photo and reserved card", () => {
  assert.match(source, /application\.participants\.every/);
  assert.match(source, /participant\.hasPhoto/);
  assert.match(source, /participant\.reservedBarcode/);
  assert.match(source, /disabled=\{[^}]*!readyToActivate/);
});
