import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/staff/PendingMembershipActions.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../components/staff/StaffMembershipReviewModal.tsx", import.meta.url), "utf8");

test("pending membership action owns the final payment activation step", () => {
  assert.match(source, /Activation Staff Name/);
  assert.match(source, /PAYMENT RECEIVED — ACTIVATE/);
  assert.match(source, /action:\s*"activate"/);
  assert.match(source, /applicationId:\s*application\.id/);
});

test("activation card readiness is participant-specific and a missing photo is non-blocking", () => {
  assert.match(source, /application\.participants\.every/);
  assert.match(source, /participant\.existingMemberId\s*\?\s*participant\.cardVerified\s*:\s*Boolean\(participant\.reservedBarcode\)/);
  assert.doesNotMatch(source, /participant\.hasPhoto\s*&&/);
  assert.match(source, /disabled=\{[^}]*!readyToActivate/);
  assert.match(review, /A missing photo does not block activation/);
});
