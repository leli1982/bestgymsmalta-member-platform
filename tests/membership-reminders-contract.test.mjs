import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260929_121500_membership_expiry_reminders.sql", import.meta.url),
  "utf8",
);
const defaultOnMigration = fs.readFileSync(
  new URL("../supabase/migrations/20261008194935_renewal_reminders_enabled_by_default.sql", import.meta.url),
  "utf8",
);
const engine = fs.readFileSync(
  new URL("../lib/membershipReminderEngine.ts", import.meta.url),
  "utf8",
);
const pushDelivery = fs.readFileSync(
  new URL("../lib/memberPushNotifications.ts", import.meta.url),
  "utf8",
);
const cron = fs.readFileSync(
  new URL("../app/api/cron/membership-expiry-reminders/route.ts", import.meta.url),
  "utf8",
);
const settingsApi = fs.readFileSync(
  new URL("../app/api/system/membership-reminders/route.ts", import.meta.url),
  "utf8",
);
const memberPush = fs.readFileSync(
  new URL("../app/api/member/push/route.ts", import.meta.url),
  "utf8",
);
const more = fs.readFileSync(
  new URL("../components/more/MorePage.tsx", import.meta.url),
  "utf8",
);
const adminNotifications = fs.readFileSync(
  new URL("../components/admin/NotificationSettingsAdmin.tsx", import.meta.url),
  "utf8",
);
const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("membership reminders now default on and remain deduplicated by member expiry interval and channel", () => {
  assert.match(migration, /unique \(member_id, membership_expiry, days_before, channel\)/i);
  assert.match(migration, /days_before in \(1,7,14,21,30\)/i);
  assert.match(defaultOnMigration, /alter column enabled set default true/i);
  assert.match(defaultOnMigration, /set enabled = true/i);
  assert.match(settingsApi, /enabled:\s*true/);
  assert.match(engine, /enabled:\s*row\?\.enabled\s*!==\s*false/);
});

test("daily reminder engine filters effective members and skips scheduled cancellations", () => {
  assert.match(engine, /\.eq\("status", "active"\)/);
  assert.match(engine, /\.is\("archived_at", null\)/);
  assert.match(engine, /\.is\("cancellation_effective_date", null\)/);
  assert.match(engine, /no_usable_email/);
  assert.match(engine, /app_not_activated/);
  assert.match(engine, /no_push_subscription/);
});

test("membership expiry push remains wired through its dedicated wrapper", () => {
  assert.match(engine, /sendMemberMembershipReminderPush/);
  assert.match(pushDelivery, /export async function sendMemberMembershipReminderPush/);
  assert.match(pushDelivery, /buildMembershipReminderPush\(input\)/);
  assert.match(pushDelivery, /return sendMemberPush\(input\.memberId,/);
});

test("reminder cron is secret protected and scheduled once daily", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /authorization/);
  assert.ok(Array.isArray(vercel.crons));
  assert.ok(vercel.crons.some((item) => item.path === "/api/cron/membership-expiry-reminders"));
});

test("Super Admin and signed-in member both have reminder controls", () => {
  assert.match(settingsApi, /requireSuperAdmin/);
  assert.match(adminNotifications, /MembershipReminderSettingsAdmin/);
  assert.match(memberPush, /getMemberRequestSession/);
  assert.match(memberPush, /bgm_member_push_subscriptions/);
  assert.match(more, /MemberReminderNotifications/);
});
