import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const permissions = readFileSync(new URL("../lib/systemPermissions.ts", import.meta.url), "utf8");
const userCore = readFileSync(new URL("../lib/systemUserCore.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../lib/systemAuth.ts", import.meta.url), "utf8");
const authRoute = readFileSync(new URL("../app/api/system/auth/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261020092005_gym_manager_role_foundation.sql", import.meta.url), "utf8");

test("gym manager is an explicit role with analytics-only permission foundation", () => {
  assert.match(permissions, /GYM_MANAGER_PERMISSIONS/);
  assert.match(permissions, /"analytics\.view"/);
  assert.match(userCore, /gym_manager/);
  assert.match(userCore, /managerGymIds/);
});

test("system auth resolves manager gym assignments server-side on every request", () => {
  assert.match(auth, /role/);
  assert.match(auth, /bgm_manager_gym_assignments/);
  assert.match(auth, /managedGymIds/);
  assert.match(authRoute, /managedGymIds/);
});

test("manager assignment storage is many-to-many and server-only", () => {
  assert.match(migration, /bgm_manager_gym_assignments/);
  assert.match(migration, /primary key \(manager_user_id, gym_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.bgm_manager_gym_assignments from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.bgm_manager_gym_assignments to service_role/);
});
