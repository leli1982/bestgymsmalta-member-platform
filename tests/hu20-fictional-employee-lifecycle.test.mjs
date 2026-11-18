import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = p => fs.readFileSync(p, "utf8");
const admin = read("app/api/system/staff-hu20/enrollments/route.ts");
const pending = read("app/api/staff-hu20/enrollments/pending/route.ts");
const complete = read("app/api/staff-hu20/enrollments/complete/route.ts");
const guard = read("supabase/test-only/hu20-fictional-enrollment-guard.sql");

test("TEST Super Admin authorises fictional staff directly but real pilot only behind all individual gates", () => {
  assert.match(admin, /like\("id_number", "HU20-TEST-%"\)/);
  assert.match(admin, /const fictional = employee\.data\?\.id_number\?\.startsWith\("HU20-TEST-"\) === true/);
  assert.match(admin, /if \(!fictional\) \{/);
  assert.match(admin, /!hu20RealStaffPilotEnabled\(\)/);
  assert.match(admin, /Super Admin pilot authorisation required/);
  assert.match(admin, /hu20_punch_clock_enabled !== true/);
  assert.match(admin, /scope: fictional \? "test" : "real_staff_pilot"/);
  assert.match(admin, /requireSuperAdmin\(request\)/);
});

test("pending TEST enrollment never exposes an unapproved real employee", () => {
  assert.match(pending, /const fictional = employee\.data\?\.id_number\?\.startsWith\("HU20-TEST-"\) === true/);
  assert.match(pending, /let eligible = fictional/);
  assert.match(pending, /row\.metadata\?\.scope === "real_staff_pilot"/);
  assert.match(pending, /hu20RealStaffPilotEnabled\(\)/);
  assert.match(pending, /\.eq\("enabled",true\)/);
  assert.match(pending, /if \(!employee\.data\?\.active \|\| !eligible\)/);
  assert.match(pending, /fingerprintCaptureEnabled: false/);
});

test("upload rechecks employee and pilot approval before encrypted template is saved", () => {
  assert.match(complete, /const fictional = employee\.data\?\.id_number\?\.startsWith\("HU20-TEST-"\) === true/);
  assert.match(complete, /const pilotScope = pending\.data\.metadata\?\.scope === "real_staff_pilot"/);
  assert.match(complete, /Real staff pilot authorisation revoked/);
  assert.match(complete, /hu20RealStaffPilotEnabled\(\)/);
  assert.match(complete, /fictional \? "bgm_hu20_test_complete_enrollment" : "bgm_hu20_pilot_complete_enrollment"/);
  assert.ok(complete.indexOf('select("id,active,id_number")') < complete.indexOf("sealHu20Template(template"));
  assert.match(guard, /id_number LIKE ''HU20-TEST-%''/);
  assert.match(guard, /Unexpected RPC body: refusing modification/);
  assert.match(guard, /isolated HU20 TEST Supabase/);
});
