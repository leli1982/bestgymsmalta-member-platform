import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const queuePath = new URL("../lib/offlineMembershipQueue.ts", import.meta.url);

function source() {
  assert.ok(fs.existsSync(queuePath), "offline membership queue module must exist");
  return fs.readFileSync(queuePath, "utf8");
}

test("offline membership queue uses IndexedDB without putting applicant PII in localStorage", () => {
  const text = source();
  assert.match(text, /indexedDB\.open/);
  assert.match(text, /bgm-staff-offline-memberships/);
  assert.match(text, /membership-sales/);
  assert.match(text, /enrollment-contexts/);
  assert.match(text, /keyPath:\s*["']clientSubmissionId["']/);
  assert.doesNotMatch(text, /localStorage/);
});

test("offline queue exposes context and sale lifecycle operations", () => {
  const text = source();
  for (const name of [
    "cacheOfflineEnrollmentContext",
    "loadLatestOfflineEnrollmentContext",
    "enqueueOfflineMembership",
    "listOfflineMemberships",
    "updateOfflineMembershipState",
    "removeOfflineMembership",
  ]) {
    assert.match(text, new RegExp(`export\\s+async\\s+function\\s+${name}`));
  }
  assert.match(text, /clientSubmissionId/);
  assert.match(text, /offlineReference/);
  assert.match(text, /soldAt/);
  assert.match(text, /pendingCardValues/);
  assert.match(text, /payment/);
  assert.match(text, /verifications/);
  assert.match(text, /photos/);
});

test("offline records never allocate a permanent BGM number locally", () => {
  const text = source();
  assert.doesNotMatch(text, /nextMemberNumber|allocateMemberNumber|reserveMemberNumber/i);
  assert.match(text, /OFFLINE-/);
});
