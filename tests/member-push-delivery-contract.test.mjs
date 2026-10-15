import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sender = fs.readFileSync(
  new URL("../lib/memberPushNotifications.ts", import.meta.url),
  "utf8",
);

test("member push delivery exposes a reusable sender for standard member notification payloads", () => {
  assert.match(sender, /export async function sendMemberPush\(/);
  assert.match(sender, /memberId:\s*string/);
  assert.match(sender, /title:\s*string/);
  assert.match(sender, /body:\s*string/);
  assert.match(sender, /url\?:\s*string/);
  assert.match(sender, /tag\?:\s*string/);
  assert.match(sender, /\.from\("bgm_member_push_subscriptions"\)/);
  assert.match(sender, /\.eq\("member_id",\s*memberId\)/);
  assert.match(sender, /\.eq\("active",\s*true\)/);
  assert.match(sender, /JSON\.stringify\(payload\)/);
});

test("generic member push retains per-device success and dead-subscription cleanup behavior", () => {
  assert.match(sender, /for \(const subscription of subscriptions\)/);
  assert.match(sender, /webpush\.sendNotification/);
  assert.match(sender, /last_success_at:\s*now/);
  assert.match(sender, /failure_count:\s*0/);
  assert.match(sender, /last_failure_at:\s*now/);
  assert.match(sender, /Number\(subscription\.failure_count \|\| 0\) \+ 1/);
  assert.match(sender, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(sender, /update\.active = false/);
  assert.match(sender, /status:\s*"not_available"/);
  assert.match(sender, /subscriptions:\s*subscriptions\.length/);
});

test("membership reminder push remains a thin wrapper over generic member delivery", () => {
  assert.match(sender, /export async function sendMemberMembershipReminderPush/);
  assert.match(sender, /buildMembershipReminderPush\(input\)/);
  assert.match(
    sender,
    /return sendMemberPush\(input\.memberId,\s*buildMembershipReminderPush\(input\)\);/s,
  );
});
