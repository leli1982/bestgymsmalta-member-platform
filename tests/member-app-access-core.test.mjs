import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreUrl = new URL("../lib/memberAppAccessCore.ts", import.meta.url);
assert.ok(existsSync(fileURLToPath(coreUrl)), "memberAppAccessCore.ts must exist before member app access behavior can pass");

const { evaluateMemberAppAccess } = await import(coreUrl.href);

function access(input = {}) {
  return evaluateMemberAppAccess({
    today: "2026-10-08",
    status: "active",
    membershipExpiry: "2026-10-08",
    reminderDays: [1, 7, 14, 21, 30],
    ...input,
  });
}

test("expiry day remains active", () => {
  assert.deepEqual(access(), {
    state: "active",
    daysUntilExpiry: 0,
    graceDaysRemaining: 0,
    reminderDue: false,
  });
});

test("the seven calendar days after expiry remain in grace", () => {
  for (let day = 1; day <= 7; day += 1) {
    const today = `2026-10-${String(8 + day).padStart(2, "0")}`;
    const result = access({ today });
    assert.equal(result.state, "grace");
    assert.equal(result.graceDaysRemaining, 8 - day);
  }
});

test("day eight after expiry is locked", () => {
  const result = access({ today: "2026-10-16" });
  assert.equal(result.state, "locked");
  assert.equal(result.graceDaysRemaining, 0);
});

test("pre-expiry reminder follows configured reminder days", () => {
  const result = access({ membershipExpiry: "2026-10-15", reminderDays: [7] });
  assert.equal(result.state, "active");
  assert.equal(result.daysUntilExpiry, 7);
  assert.equal(result.reminderDue, true);
});

test("pre-expiry reminder stays off on unconfigured days", () => {
  const result = access({ membershipExpiry: "2026-10-13", reminderDays: [1, 7] });
  assert.equal(result.daysUntilExpiry, 5);
  assert.equal(result.reminderDue, false);
});

test("inactive or cancelled membership locks immediately", () => {
  assert.equal(access({ status: "inactive", membershipExpiry: "2026-12-31" }).state, "locked");
  assert.equal(access({ status: "active", cancellationEffective: true, membershipExpiry: "2026-12-31" }).state, "locked");
});
