import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

test("Super Admin gym creation provisions routes and one shared gym staff account", () => {
  const route = read("app/api/admin/gyms/route.ts");
  assert.match(route, /mode === ["']create["']/);
  assert.match(route, /buildGymProvisioningIdentity/);
  assert.match(route, /public_enrollment_slug/);
  assert.match(route, /bgm_system_users/);
  assert.match(route, /password_hash/);
  assert.match(route, /bcrypt\.hash/);
  assert.match(route, /GYM_STAFF_PERMISSIONS/);
  assert.match(route, /joinPath/);
  assert.match(route, /staffPath/);
});

test("gym-specific staff route resolves the gym and renders a scoped password login", () => {
  const pagePath = join(root, "app/staff/[gymSlug]/page.tsx");
  assert.equal(existsSync(pagePath), true, "gym-specific staff page must exist");
  const page = read("app/staff/[gymSlug]/page.tsx");
  const login = read("components/staff/StaffLoginPage.tsx");
  const auth = read("app/api/system/auth/route.ts");

  assert.match(page, /public_enrollment_slug/);
  assert.match(page, /StaffLoginPage/);
  assert.match(page, /expectedGym/);
  assert.match(login, /expectedGym/);
  assert.match(login, /gymSlug/);
  assert.match(login, /Staff password/);
  assert.match(auth, /public_enrollment_slug/);
  assert.match(auth, /gym_id/);
  assert.match(auth, /gymSlug/);
});

test("Super Admin retains the ability to change gym staff passwords", () => {
  const api = read("app/api/admin/system-users/route.ts");
  const ui = read("components/admin/SystemUsersAdmin.tsx");
  assert.match(api, /body\.password/);
  assert.match(api, /bcrypt\.hash/);
  assert.match(ui, /New password \(optional\)/);
  assert.match(ui, /Change/);
});
