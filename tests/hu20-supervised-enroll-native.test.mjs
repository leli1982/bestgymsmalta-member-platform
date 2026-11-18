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


test("HU20 capture helper is defined and securely clears images and templates", () => {
 const ps=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollEmployee.ps1","utf8");
 const clearPosition = ps.indexOf("function Clear-Bytes(");
 const capturePosition = ps.indexOf("function Get-TransientTemplate(");
 assert.ok(clearPosition > 0 && capturePosition > clearPosition, "Clear-Bytes must be defined before the scanner runs");
 assert.match(ps, /function Clear-Bytes\(\[byte\[\]\]\$value\)/);
 assert.match(ps, /\[Array\]::Clear\(\$value, 0, \$value.Length\)/);
 assert.match(ps, /finally\s*\{\s*Clear-Bytes \$raw/);
 assert.match(ps, /if \(-not \$keepBuffer\) \{ Clear-Bytes \$buffer \}/);
 assert.match(ps, /finally\s*\{\s*Clear-Bytes \$first/);
 assert.match(ps, /Clear-Bytes \$second/);
});

test("one-click fingerprint enrollment requires a separate third placement before storing initial template", () => {
 const ps=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollEmployee.ps1","utf8");
 const normalMatch=ps.indexOf('MatchTemplate',ps.indexOf('Write-Host "Second test fingerprint capture..."'));
 const thirdLift=ps.indexOf('Wait-Hu20FingerLift $manager $width $height', normalMatch);
 const thirdCapture=ps.indexOf('$verification = Get-TransientTemplate $manager $width $height $maxSize', thirdLift);
 const firstVerification=ps.indexOf("Check-SdkResult 'VerifyStoredTemplate'", thirdCapture);
 const secondVerification=ps.indexOf("Check-SdkResult 'VerifySecondCapture'", firstVerification);
 const upload=ps.indexOf('templateBase64 = [Convert]::ToBase64String($first)',secondVerification);
 assert.ok(normalMatch>0 && thirdLift>normalMatch && thirdCapture>thirdLift &&
   firstVerification>thirdCapture && secondVerification>firstVerification && upload>secondVerification);
 assert.match(ps,/if \(-not \$firstVerified -or -not \$secondVerified\) \{\s*throw /);
 assert.match(ps,/if \(\$UseProvisionedBridge\) \{/);
 assert.match(ps,/Clear-Bytes \$verification/);
 assert.match(ps,/enrollmentExpires -le \[DateTimeOffset\]::UtcNow/);
 assert.doesNotMatch(ps,/ToBase64String\(\$verification\)/);
});

test("TEST enrollment progress screen is closed in scanner cleanup after SDK error",()=>{
 const ps=fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-EnrollEmployee.ps1","utf8");
 assert.match(ps,/\. \(Join-Path \$PSScriptRoot "Hu20-EnrollmentDisplay.ps1"\)/);
 assert.match(ps,/Initialize-Hu20EnrollmentScreen/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "scan1"/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "remove1"/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "scan2"/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "remove2"/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "scan3"/);
 assert.match(ps,/Set-Hu20EnrollmentScreen -Stage "failure"/);
 assert.match(ps,/Close-Hu20EnrollmentScreen/);
});
