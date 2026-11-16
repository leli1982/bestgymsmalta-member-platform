import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const root="native/Bgm.SecuGenHu20Probe/";
const native=fs.readFileSync(root+"Hu20-AutoKiosk.ps1","utf8");
const screen=fs.readFileSync(root+"Hu20-KioskDisplay.ps1","utf8");
const helper=fs.readFileSync(root+"Hu20-KioskSafety.ps1","utf8");
const policyTest=fs.readFileSync(root+"Test-Hu20KioskSafety.ps1","utf8");

test("kiosk fail-closed policy is imported before any TEST fingerprint capture",()=>{
  assert.match(native,/Hu20-KioskSafety[.]ps1/);
  assert.match(native,/[.] \$safetyPath/);
  assert.match(native,/Get-Hu20KioskFailurePolicy -Reason \$reason/);
  assert.match(native,/KIOSK_DEVICE_ERROR/);
  assert.match(native,/KIOSK_NETWORK_ERROR/);
  assert.match(native,/KIOSK_PUNCH_UNCERTAIN/);
  assert.match(helper,/Get-Hu20KioskFailurePolicy/);
  assert.match(helper,/Test-Hu20KioskCanPunch/);
  assert.doesNotMatch(helper,/Set-Content|Out-File|Invoke-WebRequest|Start-Process|New-Service|Supabase|storage/i);
});

test("no-match and ambiguous fingerprint are excluded from all TEST attendance writes",()=>{
  assert.match(native, /if \(\$outcome -eq "one_match"\)/);
  assert.match(native,/Test-Hu20KioskCanPunch -Outcome \$outcome/);
  assert.match(native,/CENTRAL_NO_MATCH/);
  assert.match(native,/CENTRAL_AMBIGUOUS/);
  assert.match(policyTest,/no_match/);
  assert.match(policyTest,/ambiguous/);
  assert.match(policyTest,/one_match/);
});

test("unknown attendance response cannot retry, toggle, or display a successful punch",()=>{
  assert.match(native,/KIOSK_PUNCH_UNCERTAIN: attendance response was not confirmed/);
  assert.match(native,/KIOSK_PUNCH_UNCERTAIN: attendance response was unreadable/);
  assert.match(native,/KIOSK_PUNCH_UNCERTAIN: attendance confirmation invalid/);
  assert.match(native,/decision[.]RequiresAdminReview/);
  assert.match(native,/decision[.]Mode -eq "retry"/);
  assert.match(native,/no unattended reconnect/i);
  assert.match(screen,/CHECK ATTENDANCE/);
  assert.match(screen,/READER ERROR/);
  assert.match(screen,/NETWORK ERROR/);
  assert.match(screen,/Not real employee punches|No real employee punches/);
  assert.doesNotMatch(helper,/Restart-Computer|New-Service|Start-Service|Register-ScheduledTask/);
});
