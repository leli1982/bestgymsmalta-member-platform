import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("HU20 supervised TEST enrollment performs two scans and only uploads after matching", () => {
 const ps=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollEmployee.ps1","utf8");
 assert.match(ps,/api\/staff-hu20\/enrollments\/pending/);
 assert.match(ps,/api\/staff-hu20\/enrollments\/complete/);
 assert.match(ps,/Read-Host "Verify employee physically present/);
 assert.match(ps,/Get-TransientTemplate \$manager/g);
 assert.match(ps,/MatchTemplate/);
 assert.match(ps,/throw "The two captures do not match/);
 assert.match(ps,/Clear-Bytes \$first/);
 assert.match(ps,/Clear-Bytes \$second/);
 assert.match(ps,/ConvertTo-Json -Compress/);
 assert.match(ps,/-MaximumRedirection 0/);
 assert.doesNotMatch(ps,/bgm_staff_record_punch|private-test\.bgmcred|recordStaffPunch/);
});
