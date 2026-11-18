import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const r="native/Bgm.SecuGenHu20Probe/";
const s=fs.readFileSync(r+"Hu20-AutoKiosk.ps1","utf8");
const starter=fs.readFileSync(r+"Hu20-StartTestTerminal.ps1","utf8");
const cmd=fs.readFileSync(r+"Hu20-KIOSK-TEST.cmd","utf8");
const old=fs.readFileSync(r+"Hu20-TestPunch.ps1","utf8");
test("separate TEST kiosk launcher leaves supervised test script untouched",()=>{
  assert.match(cmd,/Hu20-StartTestTerminal[.]ps1" -AutoKioskTest/);
  assert.match(starter,/\[switch\]\$AutoKioskTest/);
  assert.match(starter,/Hu20-AutoKiosk[.]ps1/);
  assert.match(starter,/-EnableFictionalTestAttendance -AutoKioskTest/);
  assert.match(old,/One authorisation is needed for EVERY scan/);
  assert.doesNotMatch(old,/X-BGM-HU20-Kiosk-Test/);
});
test("automatic one-time recognition remains server-enforced, no-match cannot punch",()=>{
  for (const pattern of [/X-BGM-HU20-Kiosk-Test/,/KIOSK_WINDOW_FINISHED/,/KIOSK_COOLDOWN/,/KIOSK_NO_FINGER_TIMEOUT/,/NORMAL_TEST_ONLY/,/api\/staff-hu20\/recognition\/begin/,/api\/staff-hu20\/recognition\/finish/,/api\/staff-hu20\/attendance/,/Clear-Bytes \$live/,/Clear-Bytes \$item.Template/]) assert.match(s,pattern);
  assert.match(s,/\$result -eq 54/);
  assert.match(s,/Check-SdkResult 'GetImageEx' \$result/);
  assert.match(s,/Wait-Hu20FingerRemoval \$manager \$width \$height/);
  assert.match(s,/\$absentChecks -ge 2/);
  assert.doesNotMatch(s,/Set-Content|Out-File|Add-Content/);
  assert.match(s,/bestgymsmalta-member-platform-/);
  assert.match(s,/leliapap-2558s-projects/);
});
