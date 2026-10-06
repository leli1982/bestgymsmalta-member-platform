import test from "node:test";
import assert from "node:assert/strict";

import {
  constantTimeSecretHashEquals,
  createTerminalSecret,
  hashTerminalSecret,
  terminalCookieName,
} from "../lib/staffTerminalAuth.ts";

test("terminal secrets are high-entropy base64url values", () => {
  const first = createTerminalSecret();
  const second = createTerminalSecret();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("terminal secret hashing is stable SHA-256 and distinguishes secrets", () => {
  const secret = "test-terminal-secret";
  const first = hashTerminalSecret(secret);
  const second = hashTerminalSecret(secret);
  const other = hashTerminalSecret("different-terminal-secret");

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test("terminal cookie name is stable", () => {
  assert.equal(terminalCookieName(), "bgm_staff_terminal");
});

test("constant-time hash comparison returns true only for equal valid hashes", () => {
  const first = hashTerminalSecret("first");
  const same = hashTerminalSecret("first");
  const other = hashTerminalSecret("other");

  assert.equal(constantTimeSecretHashEquals(first, same), true);
  assert.equal(constantTimeSecretHashEquals(first, other), false);
  assert.equal(constantTimeSecretHashEquals(first, "not-a-sha256-hash"), false);
});
