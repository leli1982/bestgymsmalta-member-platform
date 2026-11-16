import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const r = (path) => fs.readFileSync(path, "utf8");
const migration = r("supabase/test-only/hu20-test-per-gym-rollout.sql");
const admin = r("app/api/system/staff-hu20/gym-rollout/route.ts");
const portal = r("app/api/staff-hu20/portal-capability/route.ts");
const preflight = r("app/api/staff-hu20/kiosk/preflight/route.ts");
const begin = r("app/api/staff-hu20/recognition/begin/route.ts");
const attendance = r("app/api/staff-hu20/attendance/route.ts");
const kiosk = r("app/api/system/staff-hu20/kiosk/route.ts");
const gymUI = r("components/staff/Hu20GymRolloutPanel.tsx");
const staffUI = r("components/staff/StaffDashboard.tsx");
test("gym rollout defaults OFF and is audited atomically by Super Admin", () => {
  assert.match(migration,/hu20_punch_clock_enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration,/bgm_hu20_test_set_gym_rollout/);
  assert.match(migration,/FOR UPDATE/);
  assert.match(migration,/bgm_hu20_test_kiosk_windows/);
  assert.match(migration,/w\.status=\x27active\x27/);
  assert.match(migration,/staff\.hu20\.gym_rollout\.changed\.test/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION .* TO service_role/);
  assert.match(migration,/FROM PUBLIC,anon,authenticated/);
  assert.match(admin,/requireSuperAdmin\(request\)/g);
  assert.match(admin,/isHu20TestRequestEnabled\(\)/g);
  assert.match(admin,/request\.headers\.get\("origin"\)/);
  assert.match(admin,/bgm_hu20_test_set_gym_rollout/);
});
test("TEST staff portal checks signed session gym, never arbitrary gym ID", () => {
  assert.match(portal,/getSystemContext\(request\)/);
  assert.match(portal,/context\.gymId/);
  assert.match(portal,/hu20_punch_clock_enabled === true/);
  assert.doesNotMatch(portal,/searchParams|request\.nextUrl\.searchParams/);
  assert.match(gymUI,/Disable Punch Clock/);
  assert.match(gymUI,/Enable Punch Clock/);
  assert.match(staffUI,/punchClockEnabled && <Tile label="Punch Clock"/);
  assert.match(staffUI,/fetch\("\/api\/staff-hu20\/portal-capability"/);
});
test("disable blocks kiosk preflight, recognition, kiosk start and attendance", () => {
  for (const file of [preflight, begin, attendance, kiosk]) {
    assert.match(file,/hu20_punch_clock_enabled/);
    assert.match(file,/Punch Clock is disabled for this TEST gym/);
  }
  assert.match(migration,/bgm_hu20_test_record_attendance/);
  assert.match(migration,/FOR SHARE OF g/);
  assert.match(migration,/AND g\.hu20_punch_clock_enabled IS TRUE/);
  assert.match(migration,/Unexpected attendance RPC: refusing unsafe replacement/);
});
