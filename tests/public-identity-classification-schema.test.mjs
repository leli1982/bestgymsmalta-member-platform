import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260916_130500_public_identity_classification.sql",
  "utf8"
);

test("identity classification normalizes stored and incoming documents in the database", () => {
  assert.match(sql, /bgm_classify_membership_identity\s*\(\s*p_id_number\s+text\s*\)/i);
  assert.match(sql, /regexp_replace[\s\S]*id_number/i);
  assert.match(sql, /upper\s*\(/i);
  assert.match(sql, /Europe\/Malta/i);
  assert.match(sql, /expired_inactive/i);
  assert.match(sql, /active/i);
});

test("classifier and enforcement trigger are service-role/server controlled", () => {
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.bgm_classify_membership_identity\(text\)\s+from\s+(?:public|anon|authenticated)/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bgm_classify_membership_identity\(text\)\s+to\s+service_role/i);
  assert.match(sql, /before\s+insert\s+or\s+update[\s\S]*bgm_membership_application_members/i);
  assert.match(sql, /new\.identity_match_state/i);
  assert.match(sql, /new\.matched_member_id/i);
  assert.match(sql, /active membership already exists/i);
});
