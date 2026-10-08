import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const memberUrl = new URL("../app/api/member/notification-preferences/route.ts", import.meta.url);
const adminUrl = new URL("../app/api/system/member-engagement-settings/route.ts", import.meta.url);
const memberPath = fileURLToPath(memberUrl);
const adminPath = fileURLToPath(adminUrl);

function sourceIfPresent(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

test("member notification preferences API exists and is scoped to the authenticated member session", () => {
  assert.equal(fs.existsSync(memberPath), true, "member notification preferences route must exist");
  const source = sourceIfPresent(memberPath);
  assert.match(source, /getMemberRequestSession/);
  assert.match(source, /session\.memberId/);
  assert.match(source, /bgm_member_notification_preferences/);
  assert.doesNotMatch(source, /body\.memberId/);
  assert.match(source, /criticalEnabled:\s*row\?\.critical_enabled\s*\?\?\s*true/);
  assert.match(source, /motivationalEnabled:\s*row\?\.motivational_enabled\s*\?\?\s*true/);
});

test("member notification preferences PATCH persists only account category booleans", () => {
  const source = sourceIfPresent(memberPath);
  assert.match(source, /export async function PATCH/);
  assert.match(source, /critical_enabled/);
  assert.match(source, /motivational_enabled/);
  assert.match(source, /onConflict:\s*"member_id"/);
  assert.match(source, /member_id:\s*session\.memberId/);
});

test("Super Admin engagement settings API is protected and keeps rollout controls separate", () => {
  assert.equal(fs.existsSync(adminPath), true, "Super Admin engagement settings route must exist");
  const source = sourceIfPresent(adminPath);
  assert.match(source, /requireSuperAdmin/);
  assert.match(source, /bgm_member_engagement_settings/);
  assert.match(source, /"member_engagement"/);
  assert.match(source, /enabled/);
  assert.match(source, /inactivity_enabled/);
  assert.match(source, /streak_enabled/);
  assert.match(source, /updated_by_system_user_id:\s*auth\.context\.systemUserId/);
  assert.match(source, /action_key:\s*"member_engagement\.settings_updated"/);
});
