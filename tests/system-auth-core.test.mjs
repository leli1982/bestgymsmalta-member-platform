import test from "node:test";
import assert from "node:assert/strict";
import {
  createSystemSessionToken,
  verifySystemSessionToken,
  hasSystemPermission,
  resolveSystemSessionSecret,
  getSystemSessionCookieOptions,
  getClearedSystemSessionCookieOptions,
} from "../lib/systemAuthCore.ts";

const identity = {
  systemUserId: "user-123",
  gymId: "birkirkara",
  username: "birkirkarafitness",
  displayName: "Birkirkara Fitness",
  isSuperAdmin: false,
};

const authorization = {
  isSuperAdmin: false,
  permissions: ["members.view", "members.create", "orders.sundries.submit"],
};

test("creates and verifies a signed identity-only system-account session", () => {
  const token = createSystemSessionToken(identity, "test-secret", {
    now: 1_000,
    ttlMs: 60_000,
    nonce: "fixed",
  });

  assert.deepEqual(
    verifySystemSessionToken(token, "test-secret", { now: 2_000 }),
    {
      ...identity,
      issuedAt: 1_000,
      expiresAt: 61_000,
    }
  );

  assert.equal(token.includes("members.create"), false);
});

test("rejects tampered and expired system-account sessions", () => {
  const token = createSystemSessionToken(identity, "test-secret", {
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
    JSON.stringify({ ...identity, isSuperAdmin: true, issuedAt: 1_000, expiresAt: 2_000, nonce: "fixed" })
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
  assert.equal(hasSystemPermission(authorization, "members.view"), true);
  assert.equal(hasSystemPermission(authorization, "members.create"), true);
  assert.equal(hasSystemPermission(authorization, "members.delete"), false);
  assert.equal(hasSystemPermission(authorization, "orders.bar.submit"), false);
});

test("Super Admin bypasses individual permission checks", () => {
  assert.equal(
    hasSystemPermission(
      { isSuperAdmin: true, permissions: [] },
      "anything.at.all"
    ),
    true
  );
});

test("system sessions prefer a dedicated secret and use secure strict cookies", () => {
  assert.equal(
    resolveSystemSessionSecret({
      BGM_SYSTEM_SESSION_SECRET: "system-secret",
      BGM_ADMIN_SESSION_SECRET: "admin-secret",
      BGM_ADMIN_PIN: "1234",
    }),
    "system-secret"
  );
  assert.equal(
    resolveSystemSessionSecret({ BGM_ADMIN_SESSION_SECRET: "admin-secret" }),
    "admin-secret"
  );
  assert.equal(resolveSystemSessionSecret({ BGM_ADMIN_PIN: "1234" }), "1234");
  assert.equal(resolveSystemSessionSecret({}), null);

  assert.deepEqual(getSystemSessionCookieOptions(true), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  assert.deepEqual(getSystemSessionCookieOptions(false), {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  assert.deepEqual(getClearedSystemSessionCookieOptions(true), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 0,
  });
});
