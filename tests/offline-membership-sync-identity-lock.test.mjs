import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = new URL("../supabase/migrations/20261027_154500_offline_membership_sync_identity_lock.sql", import.meta.url);
const route = fs.readFileSync(new URL("../app/api/system/members/offline-sync/route.ts", import.meta.url), "utf8");

test("offline activation serializes normalized identities before canonical activation", () => {
  assert.equal(fs.existsSync(migrationPath), true, "identity-lock migration must exist");
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert.match(migration, /bgm_activate_offline_membership_application/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /regexp_replace[\s\S]*\[\^\[:alnum:\]\]/i);
  assert.match(migration, /order by[\s\S]*normalized_identity/i);
  assert.match(migration, /offlineIdentityConflict/i);
  assert.match(migration, /bgm_activate_membership_application\(/i);
  assert.doesNotMatch(migration, /bgm_next_member_number/i);
});

test("offline sync route converts an activation-time identity race into review", () => {
  assert.match(route, /bgm_activate_offline_membership_application/);
  assert.match(route, /offlineIdentityConflict/);
  assert.match(route, /["']active_identity["']/);
});
