import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const file = (path) => fs.readFileSync(path, "utf8");
const profile = file("components/staff/StaffEmployeeDetail.tsx");
const readiness = file("components/staff/Hu20RealStaffReadiness.tsx");
const fakeEnrollment = file("components/staff/Hu20QuickEnrollment.tsx");
const enrollApi = file("app/api/system/staff-hu20/enrollments/route.ts");
const completion = file("app/api/staff-hu20/enrollments/complete/route.ts");
const attendance = file("app/api/staff-hu20/attendance/route.ts");

test("Real employee profile shows readiness only, fictional TEST retains quick enrollment", () => {
  assert.match(profile, /!e\.idNumber\.startsWith\("HU20-TEST-"\) && <Hu20RealStaffReadiness/);
  assert.match(profile, /e\.idNumber\.startsWith\("HU20-TEST-"\) && <>/);
  assert.match(profile, /<Hu20QuickEnrollment employeeId=\{e\.id\}/);
  assert.match(readiness, /response\.status === 404/);
  assert.match(readiness, /Real employee fingerprint enrolment,/);
  assert.match(readiness, /REAL BIOMETRIC ENROLMENT DISABLED/);
  assert.doesNotMatch(readiness, /method: "POST"|method: "PATCH"|\/enroll|\/recognition/);
  assert.match(fakeEnrollment, /fictional TEST only/);
});
test("Real employee biometric capture and attendance remain blocked at API and database", () => {
  assert.match(enrollApi, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(completion, /employee\.data\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(attendance, /bgm_hu20_test_record_attendance/);
  const migration = file("supabase/migrations/20261113_140000_hu20_fictional_test_attendance.sql");
  assert.match(migration, /e\.id_number LIKE 'HU20-TEST-%'/);
});
