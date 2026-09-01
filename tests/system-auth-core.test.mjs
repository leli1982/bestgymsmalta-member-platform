import test from "node:test";
import assert from "node:assert/strict";
import {
  createSystemSessionToken,
  verifySystemSessionToken,
  hasSystemPermission,
} from "../lib/systemAuthCore.ts";

const session = {
  systemUserId: "user-123",
  gymId: "birkirkara",
  username: "birkirkarafitness",
  displayName: "Birkirkara Fitness",
  isSuperAdmin: false,
  permissions: ["members.view", "members.create", "orders.sundries.submit"],
};

test("creates and verifies a signed system-account session", () => {
  const token = createSystemSessionToken(session, "test-secret", {
    now: 1_000,
    ttlMs: 60_000,
    nonce: "fixed",
  });

  assert.deepEqual(
    verifySystemSessionToken(token, "test-secret", { now: 2_000 }),
    {
      ...session,
      issuedAt: 1_000,
      expiresAt: 61_000,
    }
  );
});

test("rejects tampered and expired system-account sessions", () => {
  const token = createSystemSessionToken(session, "test-secret", {
    now: 1_000,
    ttlMs: 1_000,
    nonce: "fixed",
  });

  assert.equal(
    verifySystemSessionToken(token, "test-secret", { now: 2_001 }),
    null
  );

  const [payload, signature] = token.split(".");
  const tampered = Buffer.from(
    JSON.stringify({ ...session, isSuperAdmin: true, issuedAt: 1_000, expiresAt: 2_000, nonce: "fixed" })
  ).toString("base64url");

  assert.notEqual(tampered, payload);
  assert.equal(
    verifySystemSessionToken(`${tampered}.${signature}`, "test-secret", {
      now: 1_500,
    }),
    null
  );
});

test("normal gym accounts only receive explicitly allowed permissions", () => {
  assert.equal(hasSystemPermission(session, "members.view"), true);
  assert.equal(hasSystemPermission(session, "members.create"), true);
  assert.equal(hasSystemPermission(session, "members.delete"), false);
  assert.equal(hasSystemPermission(session, "orders.bar.submit"), false);
});

test("Super Admin bypasses individual permission checks", () => {
  assert.equal(
    hasSystemPermission(
      { ...session, isSuperAdmin: true, permissions: [] },
      "anything.at.all"
    ),
    true
  );
});
