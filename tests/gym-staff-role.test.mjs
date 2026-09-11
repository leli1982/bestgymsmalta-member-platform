import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("authorization resolves normal gym accounts to the fixed Gym Staff bundle", () => {
  const source = read("lib/systemAuth.ts");
  assert.match(source, /GYM_STAFF_PERMISSIONS/);
  assert.doesNotMatch(source, /\.from\(["']bgm_user_permissions["']\)/);
});

test("system-user API ignores arbitrary gym permission arrays", () => {
  const source = read("app/api/admin/system-users/route.ts");
  assert.match(source, /resolveSystemUserPermissions/);
  assert.match(source, /replaceGymStaffPermissions/);
  assert.doesNotMatch(source, /sanitizeSystemPermissions\(body\.permissions\)/);
});

test("system-user admin presents Gym Staff as a fixed role, not a permission editor", () => {
  const source = read("components/admin/SystemUsersAdmin.tsx");
  assert.match(source, /Gym Staff access/i);
  assert.doesNotMatch(source, /PermissionGrid/);
  assert.doesNotMatch(source, /Save Permissions/);
});

test("normal staff home exposes only daily operational tiles", () => {
  const source = read("components/staff/StaffLoginPage.tsx");
  for (const title of ["Members", "Reception / Barcode", "Sundries", "Bar List"]) {
    assert.match(source, new RegExp(`title=["']${title.replace("/", "\\/")}["']`));
  }
  assert.doesNotMatch(source, /title=["']Offline Roster["']/);
  assert.doesNotMatch(source, /title=["']Analytics["']/);
});
