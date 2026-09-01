import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemberSessionToken,
  verifyMemberSessionToken,
} from "../lib/memberServerSession.mjs";

test("creates a signed member session that verifies to the same member id", () => {
  const token = createMemberSessionToken("member-123", "test-secret", {
    now: 1_000,
    ttlMs: 60_000,
    nonce: "fixed-nonce",
  });

  const session = verifyMemberSessionToken(token, "test-secret", { now: 2_000 });

  assert.deepEqual(session, {
    memberId: "member-123",
    issuedAt: 1_000,
    expiresAt: 61_000,
  });
});

test("rejects a tampered member session token", () => {
  const token = createMemberSessionToken("member-123", "test-secret", {
    now: 1_000,
    ttlMs: 60_000,
    nonce: "fixed-nonce",
  });

  const [payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      memberId: "member-999",
      issuedAt: 1_000,
      expiresAt: 61_000,
      nonce: "fixed-nonce",
    })
  ).toString("base64url");

  assert.notEqual(tamperedPayload, payload);
  assert.equal(
    verifyMemberSessionToken(`${tamperedPayload}.${signature}`, "test-secret", {
      now: 2_000,
    }),
    null
  );
});

test("rejects an expired member session token", () => {
  const token = createMemberSessionToken("member-123", "test-secret", {
    now: 1_000,
    ttlMs: 1_000,
    nonce: "fixed-nonce",
  });

  assert.equal(
    verifyMemberSessionToken(token, "test-secret", { now: 2_001 }),
    null
  );
});
