import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(p, "utf8");
const admin = read("app/api/system/staff-hu20/enrollments/route.ts");
const pending = read("app/api/staff-hu20/enrollments/pending/route.ts");
const complete = read("app/api/staff-hu20/enrollments/complete/route.ts");
const guard = read("supabase/test-only/hu20-fictional-enrollment-guard.sql");
const pilot=read("supabase/test-only/hu20-real-staff-pilot-paths.sql");
test("Super Admin keeps fictional enrolment and requires independent real-staff pilot approval", () => {
  assert.match(admin, /like\("id_number", "HU20-TEST-%"\)/);
  assert.match(admin, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(admin, /hu20RealStaffPilotEnabled\(\)/);
  assert.match(admin, /Super Admin pilot authorisation required/);
  assert.match(admin, /requireSuperAdmin\(request\)/);
});
test("terminal pending request only exposes authorised fictional or pilot employee", () => {
  assert.match(pending, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(pending, /row\.metadata\?\.scope === "real_staff_pilot"/);
  assert.match(pending, /hu20RealStaffPilotEnabled\(\)/);
});
test("upload rechecks employee and DB functions retain strict separate guards", () => {
  assert.match(complete, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.ok(complete.indexOf('select("id,active,id_number")') < complete.indexOf("sealHu20Template(template"));
  assert.match(complete,/Real staff pilot authorisation revoked/);
  assert.match(guard, /id_number LIKE ''HU20-TEST-%''/);
  assert.match(guard, /Unexpected RPC body: refusing modification/);
  assert.match(guard, /isolated HU20 TEST Supabase/);
  assert.match(pilot,/id_number NOT LIKE 'HU20-TEST-%'/);
  assert.match(pilot,/v_req\.metadata->>'scope' IS DISTINCT FROM 'real_staff_pilot'/);
});
