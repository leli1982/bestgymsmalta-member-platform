import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_150000_safe_add_only_legacy_member_import.sql",import.meta.url),"utf8");
test("member import requires clean preview and active Super Admin", () => {
  assert.match(sql, /conflict_rows > 0 OR v_batch.invalid_rows > 0/);
  assert.match(sql, /is_super_admin=true/);
});
test("member import is add-only and keeps existing member numbers forever", () => {
  assert.match(sql, /v_row.action='unchanged'/);
  assert.match(sql, /v_row.action='new'/);
  assert.doesNotMatch(sql, /UPDATE public\\.bgm_members SET/i);
  assert.doesNotMatch(sql, /DELETE FROM public\\.bgm_members/i);
  assert.doesNotMatch(sql, /member_number\\s*=\\s*v_row\\.pk_customer/i);
  assert.doesNotMatch(sql, /member_number\\s*=\\s*v_row\\.card_barcode/i);
});
test("new member BGM number comes from database allocator, not reused pkCustomer", () => {
  assert.match(sql, /INSERT INTO public\\.bgm_members \\(/);
  assert.doesNotMatch(sql, /INSERT INTO public\\.bgm_members \\(\\s*member_number/i);
  assert.match(sql, /RETURNING id,member_number INTO/);
  assert.match(sql, /legacy_pk_customer/);
});
test("import requires staff-only service role and preserves old card references", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION[\\s\\S]*PUBLIC,anon,authenticated/i);
  assert.match(sql, /GRANT EXECUTE[\\s\\S]*service_role/i);
  assert.match(sql, /legacy_pk_customer/);
});
