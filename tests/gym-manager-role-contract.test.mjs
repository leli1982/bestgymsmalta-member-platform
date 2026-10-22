import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const permissions = readFileSync(new URL("../lib/systemPermissions.ts", import.meta.url), "utf8");
const userCore = readFileSync(new URL("../lib/systemUserCore.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../lib/systemAuth.ts", import.meta.url), "utf8");
const authRoute = readFileSync(new URL("../app/api/system/auth/route.ts", import.meta.url), "utf8");
const managerStats = readFileSync(new URL("../app/api/manager/membership-stats/route.ts", import.meta.url), "utf8");
const managerPortal = readFileSync(new URL("../components/manager/GymManagerPortal.tsx", import.meta.url), "utf8");
const staffLogin = readFileSync(new URL("../components/staff/StaffLoginPage.tsx", import.meta.url), "utf8");
const adminUsers = readFileSync(new URL("../components/admin/SystemUsersAdmin.tsx", import.meta.url), "utf8");
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

test("manager reporting is limited to assigned gyms and counts new, renewals and grand total", () => {
  assert.match(managerStats, /requireGymManager/);
  assert.match(managerStats, /assignedGymIds\.includes\(requestedGymId\)/);
  assert.match(managerStats, /\.in\("enrollment_gym_id", selectedGymIds\)/);
  assert.match(managerStats, /application_kind/);
  assert.match(managerStats, /"new", "renewal"/);
  assert.match(managerStats, /newMemberships/);
  assert.match(managerStats, /renewals/);
  assert.match(managerStats, /grandTotal/);
});

test("Super Admin can create and edit multi-gym manager assignments while manager UI remains reporting-only", () => {
  assert.match(adminUsers, /Gym Manager/);
  assert.match(adminUsers, /managerGymIds/);
  assert.match(adminUsers, /Save assigned gyms/);
  assert.match(managerPortal, /Gym Manager Dashboard/);
  assert.match(managerPortal, /New memberships/);
  assert.match(managerPortal, /Renewals/);
  assert.match(managerPortal, /Grand total/);
  assert.doesNotMatch(managerPortal, /members\.edit|cards\.assign|membership\.activate/);
});

test("Gym Managers sign in through the normal staff login and the manager route has no dedicated login form", () => {
  assert.match(staffLogin, /sessionUser\?\.role === "gym_manager"/);
  assert.match(staffLogin, /data\.user\?\.role === "gym_manager"/);
  assert.match(staffLogin, /window\.location\.replace\("\/manager"\)/);
  assert.match(managerPortal, /window\.location\.replace\("\/staff"\)/);
  assert.doesNotMatch(managerPortal, /async function login/);
  assert.doesNotMatch(managerPortal, /<form onSubmit=\{login\}/);
});
