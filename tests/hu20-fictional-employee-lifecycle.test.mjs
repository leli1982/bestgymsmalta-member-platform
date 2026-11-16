import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(p, "utf8");
const admin = read("app/api/system/staff-hu20/enrollments/route.ts");
const pending = read("app/api/staff-hu20/enrollments/pending/route.ts");
const complete = read("app/api/staff-hu20/enrollments/complete/route.ts");
const guard = read("supabase/test-only/hu20-fictional-enrollment-guard.sql");
test("TEST Super Admin can only authorise fictional employees", () => {
  assert.match(admin, /like\("id_number", "HU20-TEST-%"\)/);
  assert.match(admin, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(admin, /requireSuperAdmin\(request\)/);
});
test("terminal pending request never exposes real employee as enrolment", () => {
  assert.match(pending, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
});
test("upload rechecks employee and TEST database guard limits inserts", () => {
  assert.match(complete, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.ok(complete.indexOf('select("id,active,id_number")') < complete.indexOf("sealHu20Template(template"));
  assert.match(guard, /id_number LIKE ''HU20-TEST-%''/);
  assert.match(guard, /Unexpected RPC body: refusing modification/);
  assert.match(guard, /isolated HU20 TEST Supabase/);
});
