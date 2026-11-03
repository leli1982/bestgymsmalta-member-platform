import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migrationPath = "supabase/migrations/20261103_100000_single_gym_pricing.sql";

test("generic schema is backward-compatible with Neptunes-only while adding its target gym", () => {
  const sql = read(migrationPath);
  assert.match(sql, /access_gym_id/);
  assert.match(sql, /access_scope in \('network', 'neptunes_only', 'single_gym'\)/);
  assert.match(sql, /set access_gym_id = 'bgm-neptunes'/);
  assert.match(sql, /where access_scope = 'neptunes_only'/);
  assert.doesNotMatch(sql, /set access_scope = 'single_gym',[\s\S]*where access_scope = 'neptunes_only'/);
});

test("gym master rows carry an opt-in single-gym pricing capability with Neptunes initially enabled", () => {
  const sql = read(migrationPath);
  assert.match(sql, /single_gym_pricing_enabled boolean not null default false/);
  assert.match(sql, /where id = 'bgm-neptunes'/);
});

test("price catalog versions are scoped to network or one gym and cannot silently overlap", () => {
  const sql = read(migrationPath);
  assert.match(sql, /access_scope text not null default 'network'/);
  assert.match(sql, /gym_id text references public\.bgm_gyms/);
  assert.match(sql, /network.*gym_id is null/is);
  assert.match(sql, /single_gym.*gym_id is not null/is);
  assert.match(sql, /bgm_membership_one_published_network_price_catalog_idx/);
  assert.match(sql, /bgm_membership_one_published_single_gym_price_catalog_idx/);
});

test("publishing retires only the current catalog in the same pricing scope", () => {
  const sql = read(migrationPath);
  assert.match(sql, /create or replace function public\.bgm_publish_membership_price_catalog/);
  assert.match(sql, /access_scope = v_target\.access_scope/);
  assert.match(sql, /gym_id is not distinct from v_target\.gym_id/);
});

test("activation copies both generic scope and target gym for new applications", () => {
  const sql = read(migrationPath);
  assert.match(sql, /set access_scope = new\.access_scope,/);
  assert.match(sql, /access_gym_id = new\.access_gym_id/);
});
