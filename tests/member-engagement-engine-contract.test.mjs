import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const engineUrl = new URL("../lib/memberEngagementEngine.ts", import.meta.url);
const cronUrl = new URL("../app/api/cron/membership-expiry-reminders/route.ts", import.meta.url);
const enginePath = fileURLToPath(engineUrl);
const cron = fs.readFileSync(cronUrl, "utf8");

function sourceIfPresent(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

test("engagement engine exists, pages active members and reads only canonical physical check-ins", () => {
  assert.equal(fs.existsSync(enginePath), true, "member engagement engine must exist");
  const engine = sourceIfPresent(enginePath);
  assert.match(engine, /export async function runMemberEngagementNotifications/);
  assert.match(engine, /PAGE_SIZE/);
  assert.match(engine, /\.from\("bgm_members"\)/);
  assert.match(engine, /\.eq\("status",\s*"active"\)/);
  assert.match(engine, /\.is\("archived_at",\s*null\)/);
  assert.match(engine, /\.from\("bgm_member_checkins"\)/);
  assert.match(engine, /\.in\("source",\s*\["qr",\s*"nfc",\s*"barcode"\]\)/);
  assert.match(engine, /attendanceDatesFromCheckins/);
});

test("engagement engine combines preferences, active subscriptions and motivational eligibility", () => {
  const engine = sourceIfPresent(enginePath);
  assert.match(engine, /bgm_member_notification_preferences/);
  assert.match(engine, /motivational_enabled/);
  assert.match(engine, /bgm_member_push_subscriptions/);
  assert.match(engine, /\.eq\("active",\s*true\)/);
  assert.match(engine, /evaluateMotivationalEligibility/);
  assert.match(engine, /motivationalEnabled:\s*preference\?\.motivational_enabled\s*\?\?\s*true/);
});

test("engagement events are claimed durably before in-app creation and generic push delivery", () => {
  const engine = sourceIfPresent(enginePath);
  const claimIndex = engine.indexOf('.from("bgm_member_engagement_notification_log")');
  const notificationIndex = engine.indexOf("createMemberNotification");
  const pushIndex = engine.indexOf("sendMemberPush");
  assert.ok(claimIndex >= 0, "engagement log claim must exist");
  assert.ok(notificationIndex > claimIndex, "in-app notification must happen after durable claim");
  assert.ok(pushIndex > claimIndex, "push delivery must happen after durable claim");
  assert.match(engine, /status:\s*"pending"/);
  assert.match(engine, /error\.code === "23505"/);
  assert.match(engine, /dedupeKey:\s*event\.eventKey/);
  assert.match(engine, /tag:\s*event\.eventKey/);
  assert.match(engine, /status === "sent"/);
  assert.match(engine, /status === "not_available"/);
});

test("global settings gate inactivity and streak processing independently", () => {
  const engine = sourceIfPresent(enginePath);
  assert.match(engine, /bgm_member_engagement_settings/);
  assert.match(engine, /enabled:\s*row\?\.enabled\s*\?\?\s*false/);
  assert.match(engine, /inactivityEnabled:\s*row\?\.inactivity_enabled\s*\?\?\s*true/);
  assert.match(engine, /streakEnabled:\s*row\?\.streak_enabled\s*\?\?\s*true/);
  assert.match(engine, /buildInactivityEvent/);
  assert.match(engine, /buildStreakEvent/);
});

test("secured daily cron runs expiry and engagement engines independently", () => {
  assert.match(cron, /runMembershipExpiryReminders/);
  assert.match(cron, /runMemberEngagementNotifications/);
  assert.match(cron, /membershipReminders/);
  assert.match(cron, /memberEngagement/);
  assert.match(cron, /Promise\.all/);
  assert.match(cron, /CRON_SECRET/);
});
