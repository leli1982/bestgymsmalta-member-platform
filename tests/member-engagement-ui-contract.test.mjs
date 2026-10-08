import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const member = fs.readFileSync(
  new URL("../components/member/MemberReminderNotifications.tsx", import.meta.url),
  "utf8",
);
const adminComponentUrl = new URL("../components/admin/MemberEngagementSettingsAdmin.tsx", import.meta.url);
const adminComponentPath = fileURLToPath(adminComponentUrl);
const admin = fs.existsSync(adminComponentPath) ? fs.readFileSync(adminComponentPath, "utf8") : "";
const notificationsAdmin = fs.readFileSync(
  new URL("../components/admin/NotificationSettingsAdmin.tsx", import.meta.url),
  "utf8",
);

test("member notification card becomes App notifications with device state and account category controls", () => {
  assert.match(member, />App notifications</);
  assert.match(member, /\/api\/member\/notification-preferences/);
  assert.match(member, /Membership & account reminders/);
  assert.match(member, /Motivation & streaks/);
  assert.match(member, /Enable notifications on this device/);
  assert.match(member, /Disable notifications on this device/);
  assert.match(member, /Test notification on this device/);
  assert.match(member, /Notification\.permission/);
});

test("member notification UI gives Home Screen PWA guidance when iOS push APIs are unavailable", () => {
  assert.match(member, /iPhone|iPad|iOS/);
  assert.match(member, /Home Screen/);
  assert.match(member, /display-mode:\s*standalone/);
});

test("Super Admin notification page includes separate engagement rollout controls", () => {
  assert.equal(fs.existsSync(adminComponentPath), true, "MemberEngagementSettingsAdmin must exist");
  assert.match(admin, /\/api\/system\/member-engagement-settings/);
  assert.match(admin, /Member engagement notifications/);
  assert.match(admin, /Global engagement/);
  assert.match(admin, /Inactivity notifications/);
  assert.match(admin, /Streak notifications/);
  assert.match(notificationsAdmin, /MemberEngagementSettingsAdmin/);
  assert.match(notificationsAdmin, /<MemberEngagementSettingsAdmin\s*\/>/);
});
