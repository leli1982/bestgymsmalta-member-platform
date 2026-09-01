import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_124000_phase2_push_keys.sql"
);

test("push key migration stores server-side VAPID configuration on notification settings", () => {
  assert.equal(fs.existsSync(migrationPath), true, "Push key migration must exist");
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /alter table public\.bgm_notification_settings/i);
  assert.match(sql, /add column if not exists vapid_public_key text/i);
  assert.match(sql, /add column if not exists vapid_private_key text/i);
  assert.match(sql, /add column if not exists vapid_subject text/i);
});
