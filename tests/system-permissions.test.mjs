import test from "node:test";
import assert from "node:assert/strict";
import {
  GYM_STAFF_PERMISSIONS,
  SYSTEM_PERMISSION_KEYS,
  isSystemPermissionKey,
  normalizeSystemUsername,
} from "../lib/systemPermissions.ts";

test("normalizes shared gym usernames consistently", () => {
  assert.equal(normalizeSystemUsername("  BirkirkaraFitness  "), "birkirkarafitness");
  assert.equal(normalizeSystemUsername("Sliema Fitness"), "sliemafitness");
  assert.equal(normalizeSystemUsername("Marsa-Fitness"), "marsafitness");
});

test("declares the Phase 2 granular permission vocabulary", () => {
  const required = ["members.view","members.create","members.edit","members.renew","members.photos.view","members.photos.capture","membership.activate","cards.assign","cards.replace","nfc.scan","nfc.assign","nfc.replace","barcode.scan","checkins.view","orders.sundries.submit","orders.sundries.history","orders.bar.submit","orders.bar.history","orders.manage","announcements.manage","analytics.view","members.import","members.export","members.archive","gyms.manage","system_users.manage","offline_roster.view"];
  for (const key of required) {
    assert.equal(SYSTEM_PERMISSION_KEYS.includes(key), true, key);
    assert.equal(isSystemPermissionKey(key), true, key);
  }
  assert.equal(isSystemPermissionKey("random.permission"), false);
});

test("Gym Staff role contains only the approved daily operational bundle", () => {
  for (const required of ["members.view","members.create","members.renew","members.photos.view","members.photos.capture","membership.activate","cards.assign","cards.replace","barcode.scan","orders.sundries.submit","orders.bar.submit"]) {
    assert.equal(GYM_STAFF_PERMISSIONS.includes(required), true, required);
  }
  for (const forbidden of ["analytics.view","system_users.manage","members.import","members.export","orders.sundries.history","orders.bar.history","orders.manage","announcements.manage","gyms.manage","offline_roster.view"]) {
    assert.equal(GYM_STAFF_PERMISSIONS.includes(forbidden), false, forbidden);
  }
});
