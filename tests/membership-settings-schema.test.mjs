import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = "supabase/migrations/20260916_120000_membership_settings.sql";

test("membership settings migration defines immutable versioned settings schema", () => {
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /create table(?: if not exists)? public\.bgm_membership_price_catalog_versions/i);
  assert.match(sql, /create table(?: if not exists)? public\.bgm_membership_price_entries/i);
  assert.match(sql, /create table(?: if not exists)? public\.bgm_membership_declaration_versions/i);
  assert.match(sql, /create table(?: if not exists)? public\.bgm_discount_codes/i);
  assert.match(sql, /amount_cents integer/i);
  assert.match(sql, /percentage integer/i);
  assert.match(sql, /bgm_publish_membership_price_catalog/i);
  assert.match(sql, /bgm_publish_membership_declaration/i);
  assert.match(sql, /where status = 'published'/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all .* from anon/i);
  assert.match(sql, /grant .* to service_role/i);
  assert.match(sql, /bgm_reject_published_membership_setting_mutation/i);
  assert.match(sql, /insert into public\.bgm_audit_log/i);
});
