import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_PERMISSION_KEYS,
  isSystemPermissionKey,
  normalizeSystemUsername,
} from "../lib/systemPermissions.ts";

test("normalizes shared gym usernames consistently", () => {
  assert.equal(normalizeSystemUsername("  BirkirkaraFitness  "), "birkarafitness".replace("kara", "kara"));
  assert.equal(normalizeSystemUsername("Sliema Fitness"), "sliemafitness");
  assert.equal(normalizeSystemUsername("Marsa-Fitness"), "marsafitness");
});

test("declares the Phase 2 granular permission vocabulary", () => {
  const required = [
    "members.view",
    "members.create",
    "members.edit",
    "members.renew",
    "members.photos.view",
    "membership.activate",
    "nfc.scan",
    "nfc.assign",
    "nfc.replace",
    "checkins.view",
    "orders.sundries.submit",
    "orders.sundries.history",
    "orders.bar.submit",
    "orders.bar.history",
    "announcements.manage",
    "analytics.view",
    "members.export",
    "members.archive",
    "gyms.manage",
    "system_users.manage",
    "offline_roster.view",
  ];

  for (const key of required) {
    assert.equal(SYSTEM_PERMISSION_KEYS.includes(key), true, key);
    assert.equal(isSystemPermissionKey(key), true, key);
  }

  assert.equal(isSystemPermissionKey("random.permission"), false);
});
