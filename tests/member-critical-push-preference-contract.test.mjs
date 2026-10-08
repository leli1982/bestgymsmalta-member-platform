import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const engine = fs.readFileSync(
  new URL("../lib/membershipReminderEngine.ts", import.meta.url),
  "utf8",
);

test("critical member preference gates expiry push while preserving existing in-app expiry notification", () => {
  assert.match(engine, /bgm_member_notification_preferences/);
  assert.match(engine, /critical_enabled/);
  assert.match(engine, /criticalPushEnabled/);
  assert.match(engine, /critical_disabled/);

  const inAppIndex = engine.indexOf("await createMemberNotification({");
  const criticalGateIndex = engine.indexOf("criticalPushEnabled");
  assert.ok(inAppIndex >= 0, "existing expiry in-app notification must remain");
  assert.ok(criticalGateIndex >= 0, "critical push preference gate must exist");
  assert.ok(inAppIndex < engine.lastIndexOf("criticalPushEnabled"), "in-app expiry creation must not be suppressed by the push preference");
});

test("missing critical preference defaults to enabled", () => {
  assert.match(engine, /critical_enabled/);
  assert.match(engine, /\?\?\s*true/);
});
