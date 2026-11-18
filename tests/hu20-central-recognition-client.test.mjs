import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const ps=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-CentralRecognise.ps1","utf8");
test("Central TEST recognition is one-shot and only matches temporarily in memory",()=>{
 assert.match(ps,/api\/staff-hu20\/recognition\/begin/);
 assert.match(ps,/api\/staff-hu20\/recognition\/finish/);
 assert.match(ps,/Read-PrivateText/);
 assert.match(ps,/-MaximumRedirection 0/g);
 assert.match(ps,/function Clear-Bytes/);
 assert.match(ps,/Get-TransientTemplate \$manager/);
 assert.match(ps,/MatchTemplate/);
 assert.match(ps,/CENTRAL_ONE_MATCH/);
 assert.match(ps,/CENTRAL_NO_MATCH/);
 assert.match(ps,/AMBIGUOUS/);
 assert.match(ps,/Clear-Bytes \$live/);
 assert.match(ps,/Clear-Bytes \$item.Template/);
 assert.match(ps,/fingerprintMatchingOnTerminal -ne \$true/);
 assert.match(ps,/noAttendanceWasRecorded -ne \$true/);
 assert.doesNotMatch(ps,/recordStaffPunch|bgm_staff_record_punch|Out-File|WriteAllBytes|Set-Content/);
});
