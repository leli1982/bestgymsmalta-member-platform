import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20261111_120000_fix_staff_price_catalog_scope_triggers.sql", import.meta.url), "utf8");
const guard = sql.split("create or replace function public.bgm_guard_new_membership_application_price()")[1]?.split("create or replace function public.bgm_enforce_membership_application_price_snapshot()")[0];
const snapshot = sql.split("create or replace function public.bgm_enforce_membership_application_price_snapshot()")[1];

test("Staff registration price check matches the published catalogue to the exact scope and gym", () => {
  assert.ok(guard, "Missing registration price trigger");
  assert.match(guard, /c\.access_scope=new\.access_scope/);
  assert.match(guard, /c\.gym_id is not distinct from new\.access_gym_id/);
  assert.match(guard, /e\.membership_type=new\.membership_type/);
  assert.match(guard, /e\.duration_key=new\.duration_key/);
  assert.match(guard, /order by c\.version_no desc limit 1/);
  assert.match(guard, /new\.price_catalog_version_id is distinct from v_catalog_id/);
  assert.match(guard, /new\.base_price_cents is distinct from v_amount_cents/);
  assert.match(guard, /new\.currency is distinct from v_currency/);
});

test("Staff price snapshot respects All Access vs Single Gym and preserves existing captured rates", () => {
  assert.ok(snapshot, "Missing application price snapshot trigger");
  assert.match(snapshot, /c\.access_scope=new\.access_scope/);
  assert.match(snapshot, /c\.gym_id is not distinct from new\.access_gym_id/);
  assert.match(snapshot, /new\.access_scope is not distinct from old\.access_scope/);
  assert.match(snapshot, /new\.access_gym_id is not distinct from old\.access_gym_id/);
  assert.match(snapshot, /new\.base_price_cents := old\.base_price_cents/);
  assert.match(snapshot, /e\.is_active is true/);
  assert.match(snapshot, /new\.final_amount_cents := v_amount_cents/);
});

test("The fix does not touch historical applications, member accounts, scanning or unrelated tables", () => {
  assert.doesNotMatch(sql, /(?:update|delete from|truncate)\s+public\.bgm_membership_applications/i);
  assert.doesNotMatch(sql, /(?:update|delete from|truncate)\s+public\.bgm_members\b/i);
  assert.doesNotMatch(sql, /drop\s+trigger/i);
  assert.match(sql, /revoke all on function public\.bgm_guard_new_membership_application_price/);
});
