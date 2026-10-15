import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const engine = fs.readFileSync(new URL("../lib/memberEngagementEngine.ts", import.meta.url), "utf8");
const adminRoute = fs.readFileSync(new URL("../app/api/system/member-engagement-settings/route.ts", import.meta.url), "utf8");
const adminUi = fs.readFileSync(new URL("../components/admin/MemberEngagementSettingsAdmin.tsx", import.meta.url), "utf8");
const migrationUrl = new URL("../supabase/migrations/20261008211500_member_engagement_enabled_by_default.sql", import.meta.url);

test("member engagement global rollout defaults ON in code fallbacks and Super Admin UI", () => {
  assert.match(engine, /enabled:\s*row\?\.enabled\s*\?\?\s*true/);
  assert.match(adminRoute, /enabled:\s*row\?\.enabled\s*\?\?\s*true/);
  assert.match(adminUi, /const defaults:[\s\S]*?enabled:\s*true/);
});

test("follow-up migration makes motivational engagement enabled by default without rewriting the applied C3 migration", () => {
  assert.equal(fs.existsSync(migrationUrl), true, "follow-up default-on migration must exist");
  const sql = fs.readFileSync(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.bgm_member_engagement_settings[\s\S]*alter column enabled set default true/i);
  assert.match(sql, /update public\.bgm_member_engagement_settings[\s\S]*set enabled = true[\s\S]*where id = 'member_engagement'/i);
  assert.doesNotMatch(sql, /drop table|delete from|truncate/i);
});
