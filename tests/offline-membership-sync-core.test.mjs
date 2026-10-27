import test from "node:test";
import assert from "node:assert/strict";
import { decideOfflineSyncOutcome } from "../lib/offlineMembershipSyncCore.ts";

const clean = { configVerified: true, identityStates: ["clear"], cardConflict: false, verificationComplete: true };

test("clean offline membership can activate", () => {
  assert.deepEqual(decideOfflineSyncOutcome(clean), { action: "activate" });
});

test("stale immutable config is held for review", () => {
  assert.deepEqual(decideOfflineSyncOutcome({ ...clean, configVerified: false }), { action: "review_required", reason: "stale_config" });
});

test("active identity is held before card checks", () => {
  assert.deepEqual(decideOfflineSyncOutcome({ ...clean, identityStates: ["active"] }), { action: "review_required", reason: "active_identity" });
});

test("expired identity is held as a possible renewal", () => {
  assert.deepEqual(decideOfflineSyncOutcome({ ...clean, identityStates: ["expired_inactive"] }), { action: "review_required", reason: "possible_renewal" });
});

test("card conflict is held for review", () => {
  assert.deepEqual(decideOfflineSyncOutcome({ ...clean, cardConflict: true }), { action: "review_required", reason: "card_conflict" });
});

test("missing verification is held for review", () => {
  assert.deepEqual(decideOfflineSyncOutcome({ ...clean, verificationComplete: false }), { action: "review_required", reason: "verification_required" });
});
