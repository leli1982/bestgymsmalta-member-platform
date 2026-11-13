import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const page=read("app/staff/admin/staff/terminals/enrollment/page.tsx");
const admin=read("app/api/system/staff-hu20/recognition/route.ts");
const begin=read("app/api/staff-hu20/recognition/begin/route.ts");
const finish=read("app/api/staff-hu20/recognition/finish/route.ts");
const ps=read("native/Bgm.SecuGenHu20Probe/Hu20-CentralRecognise.ps1");
const migration=read("supabase/migrations/20261112_180000_hu20_test_supervised_one_shot_recognition.sql");

test("one-time central TEST fingerprint scanner requires Super Admin authorization",()=>{
 assert.match(page,/Authorise one fingerprint recognition TEST/);
 assert.match(page,/cancelRecognition/);
 assert.match(admin,/requireSuperAdmin\(request\)/g);
 assert.match(admin,/BGM_HU20_RECOGNITION_TEST_ENABLED/g);
 assert.match(begin,/authenticateHu20Terminal\(request\)/);
 assert.match(begin,/bgm_hu20_test_claim_recognition/);
 assert.match(begin,/openHu20Template/);
 assert.match(begin,/HU20-TEST-%/);
 assert.match(begin,/attendanceEnabled: false/);
 assert.match(finish,/bgm_hu20_test_finish_recognition/);
 assert.match(finish,/noAttendanceWasRecorded: true/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON FUNCTION/g);
 assert.match(migration,/TO service_role/g);
 assert.match(migration,/FOR UPDATE/g);
 assert.match(migration,/b.active=true AND b.status='enrolled'/);
});

test("scanner keeps templates in RAM, clears them and never punches",()=>{
 assert.match(ps,/api\/staff-hu20\/recognition\/begin/);
 assert.match(ps,/api\/staff-hu20\/recognition\/finish/);
 assert.match(ps,/function Clear-Bytes\(\[byte\[\]\]\$value\)/);
 assert.match(ps,/Get-TransientTemplate \$manager/);
 assert.match(ps,/MatchTemplate/);
 assert.match(ps,/Clear-Bytes \$live/);
 assert.match(ps,/Clear-Bytes \$item.Template/);
 assert.match(ps,/noAttendanceWasRecorded -ne \$true/);
 assert.match(ps,/CENTRAL_ONE_MATCH/);
 assert.match(ps,/CENTRAL_NO_MATCH/);
 assert.doesNotMatch(ps,/bgm_staff_record_punch|recordStaffPunch|WriteAllBytes|Set-Content|Out-File/);
});
