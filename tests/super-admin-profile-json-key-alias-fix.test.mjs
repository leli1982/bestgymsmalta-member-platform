import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20261009_203000_super_admin_profile_json_key_alias_fix.sql",
  import.meta.url,
);

test("Super Admin profile RPC names the jsonb_object_keys scalar column and preserves least privilege", () => {
  assert.equal(
    fs.existsSync(migrationUrl),
    true,
    "profile JSON key alias repair migration must exist",
  );

  const sql = fs.readFileSync(migrationUrl, "utf8");

  assert.match(
    sql,
    /jsonb_object_keys\(p_profile\)\s+as\s+k\(key\)\s+where\s+not\s+\(k\.key\s*=\s*any\(v_keys\)\)/i,
  );
  assert.doesNotMatch(
    sql,
    /jsonb_object_keys\(p_profile\)\s+k\s+where\s+not\s+\(k\.key\s*=\s*any\(v_keys\)\)/i,
  );
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /set\s+search_path\s*=\s*''/i);
  assert.match(
    sql,
    /revoke\s+all\s+on\s+function\s+public\.bgm_super_admin_update_member_profile\(uuid,\s*uuid,\s*timestamptz,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    sql,
    /grant\s+execute\s+on\s+function\s+public\.bgm_super_admin_update_member_profile\(uuid,\s*uuid,\s*timestamptz,\s*jsonb\)\s+to\s+service_role/i,
  );
});
