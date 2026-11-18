import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(path)=>fs.readFileSync(path,"utf8");
const admin=read("app/api/system/staff-hu20/enrollments/route.ts");
const pending=read("app/api/staff-hu20/enrollments/pending/route.ts");
const complete=read("app/api/staff-hu20/enrollments/complete/route.ts");
const begin=read("app/api/staff-hu20/recognition/begin/route.ts");
const finish=read("app/api/staff-hu20/recognition/finish/route.ts");
const attendance=read("app/api/staff-hu20/attendance/route.ts");
const sql=read("supabase/test-only/hu20-real-staff-pilot-paths.sql");
const pilot=read("lib/hu20RealStaffPilot.ts");
const approvals=read("supabase/test-only/hu20-real-staff-pilot-approvals.sql");
const profile=read("components/staff/StaffEmployeeDetail.tsx");
const quick=read("components/staff/Hu20QuickEnrollment.tsx");

test("Real staff requires separate TEST enable flag and Super Admin per-person approval",()=>{
  assert.match(pilot,/hu20TestEnabled\(process\.env\)/);
  assert.match(pilot,/BGM_HU20_REAL_STAFF_PILOT_ENABLED === "true"/);
  assert.match(admin,/requireSuperAdmin\(request\)/);
  assert.match(admin,/Super Admin pilot authorisation required/);
  assert.match(admin,/hu20_punch_clock_enabled !== true/);
  assert.match(admin,/scope: fictional \? "test" : "real_staff_pilot"/);
  assert.match(approvals,/bgm_hu20_real_staff_pilot/);
  assert.match(approvals,/encrypted_template=NULL/);
});
test("Single-use native enrollment requires approval again before saving a template",()=>{
  assert.match(pending,/row\.metadata\?\.scope === "real_staff_pilot"/);
  assert.match(pending,/hu20RealStaffPilotEnabled\(\)/);
  assert.match(complete,/pending\.data\.metadata\?\.scope === "real_staff_pilot"/);
  assert.match(complete,/Real staff pilot authorisation revoked/);
  assert.match(complete,/bgm_hu20_pilot_complete_enrollment/);
  assert.match(sql,/v_req\.metadata->>'scope' IS DISTINCT FROM 'real_staff_pilot'/);
  assert.match(sql,/p\.enabled IS TRUE/);
  assert.match(sql,/g\.hu20_punch_clock_enabled IS TRUE/);
});
test("Recognition and attendance use independently guarded isolated TEST pilot DB functions",()=>{
  assert.match(begin,/pilotRoster = kioskMode && hu20RealStaffPilotEnabled\(\)/);
  assert.match(begin,/TEST pilot roster too large \(maximum 8\)/);
  assert.match(begin,/!person\.id_number\.startsWith\("HU20-TEST-"\)/);
  assert.match(finish,/bgm_hu20_pilot_finish_recognition/);
  assert.match(attendance,/bgm_hu20_pilot_record_attendance/);
  assert.match(sql,/bgm_hu20_pilot_finish_recognition/);
  assert.match(sql,/bgm_hu20_pilot_record_attendance/);
  assert.match(sql,/realStaffPilot/);
  assert.match(sql,/hu20-pilot:/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/TO service_role/);
});
test("Staff fingerprint pilot appears only with per-person authorisation",()=>{
  assert.match(profile,/Hu20PilotStaffActivation/);
  assert.match(profile,/!e\.idNumber\.startsWith\("HU20-TEST-"\)/);
  assert.match(quick,/mode === "real-pilot"/);
  assert.match(quick,/127\.0\.0\.1:8765/);
});
