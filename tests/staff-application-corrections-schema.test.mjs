import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
let sql = "";
try {
  sql = readFileSync(
    join(
      root,
      "supabase/migrations/20260915_120000_staff_application_corrections.sql"
    ),
    "utf8"
  );
} catch {}

test("staff application correction is one server-only atomic database function", () => {
  assert.match(sql, /create or replace function public\.bgm_correct_membership_application/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /bgm_membership_applications/i);
  assert.match(sql, /bgm_membership_application_members/i);
  assert.match(sql, /bgm_audit_log/i);
  assert.match(sql, /before_data/i);
  assert.match(sql, /after_data/i);
});

test("correction function enforces active staff gym ownership and remains service-role only", () => {
  assert.match(sql, /bgm_system_users/i);
  assert.match(sql, /active\s*=\s*true/i);
  assert.match(sql, /gym_id/i);
  assert.match(sql, /revoke all on function[\s\S]*from public/i);
  assert.match(sql, /revoke all on function[\s\S]*from anon/i);
  assert.match(sql, /revoke all on function[\s\S]*from authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/i);
});
