import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
const server=fs.readFileSync("app/api/system/staff-hu20/enrollments/route.ts","utf8");
const ui=fs.readFileSync("app/staff/admin/staff/terminals/enrollment/page.tsx","utf8");
const script=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollEmployee.ps1","utf8");
test("Super Admin TEST enrollment window is ten minutes, not recognition window",()=>{
 assert.match(server,/const ttlMillis = 10 \* 60 \* 1000/);
 assert.match(ui,/TEST enrollment authorised for 10 minutes/);
 assert.match(ui,/ten-minute enrollment window/);
 assert.match(ui,/one-time, five-minute recognition test/);
});
test("HU20 supervised enrollment refuses expired captures and explains upload HTTP conflicts",()=>{
 assert.match(script,/DateTimeOffset\]::Parse/);
 assert.match(script,/authorization expired during fingerprint capture/);
 assert.match(script,/GetResponseStream\(\)/);
 assert.match(script,/Supervised TEST enrollment rejected \(HTTP 409\)/);
 assert.match(script,/\$errorJson.error/);
 assert.match(script,/-MaximumRedirection 0/);
 assert.doesNotMatch(script,/recordStaffPunch|bgm_staff_record_punch|Out-File/);
});
