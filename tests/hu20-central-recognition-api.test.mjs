import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
const admin=fs.readFileSync("app/api/system/staff-hu20/recognition/route.ts","utf8");
const begin=fs.readFileSync("app/api/staff-hu20/recognition/begin/route.ts","utf8");
const finish=fs.readFileSync("app/api/staff-hu20/recognition/finish/route.ts","utf8");
const schema=fs.readFileSync("supabase/migrations/20261112_180000_hu20_test_supervised_one_shot_recognition.sql","utf8");

test("TEST biometric roster cannot be fetched without a one-use Super Admin approval",()=>{
 assert.match(admin,/requireSuperAdmin\(request\)/g);
 assert.match(admin,/validOrigin\(request\)/g);
 assert.match(admin,/BGM_HU20_RECOGNITION_TEST_ENABLED/g);
 assert.match(admin,/duration = 5 \* 60 \* 1000/);
 assert.match(begin,/authenticateHu20Terminal\(request\)/);
 assert.match(begin,/bgm_hu20_test_claim_recognition/);
 assert.match(begin,/HU20-TEST-%/);
 assert.match(begin,/roster too large/);
 assert.match(begin,/openHu20Template/);
 assert.match(begin,/template\.fill\(0\)/);
 assert.match(begin,/attendanceEnabled: false/);
 assert.doesNotMatch(begin,/export async function GET|recordStaffPunch|bgm_staff_record_punch/);
});
test("Status confirmation rejects revoked biometrics and never punches",()=>{
 assert.match(finish,/authenticateHu20Terminal\(request\)/);
 assert.match(finish,/bgm_hu20_test_finish_recognition/);
 assert.match(finish,/noAttendanceWasRecorded: true/);
 assert.match(schema,/FOR UPDATE/g);
 assert.match(schema,/b\.active=true AND b\.status='enrolled'/);
 assert.match(schema,/e\.id_number LIKE 'HU20-TEST-%'/);
 assert.match(schema,/REVOKE ALL ON FUNCTION/g);
 assert.match(schema,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(schema,/SECURITY DEFINER|recordStaffPunch|staff_record_punch/);
});
