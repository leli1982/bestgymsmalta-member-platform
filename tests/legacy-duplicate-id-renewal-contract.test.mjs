import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261124_110000_legacy_duplicate_id_existing_member_renewal.sql");
const api = read("app/api/system/members/enroll/route.ts");

test("unchanged ID on selected permanent member may renew despite legacy duplicate IDs", () => {
  assert.match(sql, /v_existing_id := upper\(regexp_replace\(coalesce\(v_selected\.id_number/);
  assert.match(sql, /IF v_input_id <> '' AND v_input_id IS DISTINCT FROM v_existing_id THEN/);
  assert.match(sql, /new\.matched_member_id := v_selected\.id/);
  assert.match(sql, /new\.existing_member_id IS NULL/);
  assert.match(sql, /archived_at IS NULL/);
});

test("newly supplied ID and mismatched known ID retain collision safeguards", () => {
  assert.match(sql, /v_existing_id <> '' AND v_input_id <> '' AND v_existing_id <> v_input_id/);
  assert.match(sql, /m\.id <> v_selected\.id/);
  assert.match(sql, /different BGM member/);
  assert.match(sql, /v_application_kind = 'new'/);
  assert.match(sql, /An active membership already exists/);
  assert.match(sql, /FOR KEY SHARE/);
});

test("identity errors are actionable for staff, not converted to generic server error", () => {
  assert.match(api, /already recorded against a different BGM member/);
  assert.match(api, /passport number differs/);
  assert.match(api, /participantMessage/);
  assert.match(api, /status: 409/);
});
