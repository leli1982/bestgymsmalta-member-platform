import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sender = fs.readFileSync(
  new URL("../lib/memberPushNotifications.ts", import.meta.url),
  "utf8",
);
const engine = fs.readFileSync(
  new URL("../lib/membershipReminderEngine.ts", import.meta.url),
  "utf8",
);

test("critical member preference gates expiry push at the expiry wrapper", () => {
  assert.match(sender, /bgm_member_notification_preferences/);
  assert.match(sender, /critical_enabled/);
  assert.match(sender, /critical_enabled === false/);
  assert.match(sender, /status:\s*"disabled"/);
  assert.match(sender, /return sendMemberPush\(input\.memberId,\s*buildMembershipReminderPush\(input\)\);/s);
});

test("missing critical preference defaults enabled and opt-out is logged without weakening in-app expiry", () => {
  assert.match(sender, /critical_enabled === false/);
  assert.match(engine, /pushResult\.status === "disabled"/);
  assert.match(engine, /reason:\s*"critical_disabled"/);

  const inAppIndex = engine.indexOf("await createMemberNotification({");
  const pushIndex = engine.indexOf("await sendMemberMembershipReminderPush({");
  assert.ok(inAppIndex >= 0 && pushIndex > inAppIndex, "existing expiry in-app notification must be created before the push preference is evaluated");
});
