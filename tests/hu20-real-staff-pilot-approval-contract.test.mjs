import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(p)=>fs.readFileSync(p,"utf8");
const migration=read("supabase/test-only/hu20-real-staff-pilot-approvals.sql");
const route=read("app/api/system/staff-hu20/pilot-staff/route.ts");
const ui=read("components/staff/Hu20PilotStaffActivation.tsx");
const profile=read("components/staff/StaffEmployeeDetail.tsx");
const env=read("lib/hu20RealStaffPilot.ts");
test("Pilot is isolated to TEST preview, independent flag, Super Admin only",()=>{
  assert.match(env,/hu20TestEnabled\(process\.env\)/);
  assert.match(env,/BGM_HU20_REAL_STAFF_PILOT_ENABLED === "true"/);
  assert.match(route,/requireSuperAdmin\(request\)/g);
  assert.match(route,/request\.headers\.get\("origin"\)/);
  assert.match(ui,/Disable and revoke fingerprint pilot/);
  assert.match(profile,/!e\.idNumber\.startsWith\("HU20-TEST-"\) && <Hu20PilotStaffActivation/);
});
test("Pilot approval DB revoke removes encrypted material, no public grants",()=>{
  assert.match(migration,/bgm_hu20_pilot_set_employee_enabled/);
  assert.match(migration,/encrypted_template=NULL/);
  assert.match(migration,/cancelled_at=now/);
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/TO service_role/);
  assert.match(migration,/id_number LIKE 'HU20-TEST-%'/);
  assert.match(migration,/FOR UPDATE/);
});
