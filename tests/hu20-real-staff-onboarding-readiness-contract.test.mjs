import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const file = path => fs.readFileSync(path, "utf8");
const profile = file("components/staff/StaffEmployeeDetail.tsx");
const readiness = file("components/staff/Hu20RealStaffReadiness.tsx");
const quick = file("components/staff/Hu20QuickEnrollment.tsx");
const pilot = file("components/staff/Hu20PilotStaffActivation.tsx");
const enrollment = file("app/api/system/staff-hu20/enrollments/route.ts");
const completion = file("app/api/staff-hu20/enrollments/complete/route.ts");
const attendance = file("app/api/staff-hu20/attendance/route.ts");

test("Real employee has read-only readiness and separately approved TEST pilot enrollment", () => {
  assert.match(profile, /!e\.idNumber\.startsWith\("HU20-TEST-"\) && <Hu20RealStaffReadiness/);
  assert.match(profile, /e\.idNumber\.startsWith\("HU20-TEST-"\) && <>/);
  assert.match(profile, /Hu20PilotStaffActivation/);
  assert.match(profile, /<Hu20QuickEnrollment employeeId=\{e\.id\}/);
  assert.match(readiness, /response\.status === 404/);
  assert.match(readiness, /pilot requires individual Super Admin authorisation/);
  assert.match(readiness, /REAL BIOMETRIC ENROLMENT DISABLED/);
  assert.doesNotMatch(readiness, /method: "POST"|method: "PATCH"|\/enroll|\/recognition/);
  assert.match(pilot, /A Super Admin must activate each real employee separately/);
  assert.match(quick, /fictional TEST only/);
  assert.match(quick, /mode === "real-pilot"/);
});

test("Real staff never uses fictional enrollment/attendance DB paths without explicit TEST pilot gates", () => {
  assert.match(enrollment, /const fictional = employee\.data\?\.id_number\?\.startsWith\("HU20-TEST-"\) === true/);
  assert.match(enrollment, /if \(!fictional\) \{/);
  assert.match(enrollment, /hu20RealStaffPilotEnabled\(\)/);
  assert.match(enrollment, /Super Admin pilot authorisation required/);
  assert.match(completion, /!fictional && \(!pilotScope \|\| !hu20RealStaffPilotEnabled\(\)\)/);
  assert.match(completion, /Real staff pilot authorisation revoked/);
  assert.match(completion, /fictional \? "bgm_hu20_test_complete_enrollment" : "bgm_hu20_pilot_complete_enrollment"/);
  assert.match(attendance, /hu20RealStaffPilotEnabled\(\) \? "bgm_hu20_pilot_record_attendance" : "bgm_hu20_test_record_attendance"/);
  const fakeSQL = file("supabase/migrations/20261113_140000_hu20_fictional_test_attendance.sql");
  const realSQL = file("supabase/test-only/hu20-real-staff-pilot-paths.sql");
  assert.match(fakeSQL, /e\.id_number LIKE 'HU20-TEST-%'/);
  assert.match(realSQL, /p\.enabled IS TRUE/);
  assert.match(realSQL, /hu20_punch_clock_enabled IS TRUE/);
});
