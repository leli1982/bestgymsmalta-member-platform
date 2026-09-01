import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSystemPermissions,
  validateSystemUserDraft,
} from "../lib/systemUserCore.ts";

test("filters permission input to the approved permission vocabulary", () => {
  assert.deepEqual(
    sanitizeSystemPermissions([
      "members.view",
      "members.view",
      "nfc.scan",
      "random.permission",
      123,
    ]),
    ["members.view", "nfc.scan"]
  );
});

test("gym accounts require gym, username, display name and a strong-enough password", () => {
  assert.deepEqual(
    validateSystemUserDraft({
      gymId: "birkirkara",
      username: "Birkirkara Fitness",
      displayName: "Birkirkara Fitness",
      password: "12345678",
      isSuperAdmin: false,
    }),
    {
      ok: true,
      gymId: "birkirkara",
      username: "birkirkarafitness",
      displayName: "Birkirkara Fitness",
    }
  );

  assert.equal(
    validateSystemUserDraft({
      gymId: "",
      username: "test",
      displayName: "Test",
      password: "12345678",
      isSuperAdmin: false,
    }).ok,
    false
  );

  assert.equal(
    validateSystemUserDraft({
      gymId: "birkirkara",
      username: "test",
      displayName: "Test",
      password: "short",
      isSuperAdmin: false,
    }).ok,
    false
  );
});

test("Super Admin accounts do not require a gym", () => {
  const result = validateSystemUserDraft({
    gymId: "",
    username: "superadmin",
    displayName: "Super Admin",
    password: "strongpass123",
    isSuperAdmin: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.gymId, null);
});
