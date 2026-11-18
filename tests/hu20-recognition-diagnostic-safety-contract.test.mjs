import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dir="native/Bgm.SecuGenHu20Probe/";
const read=p=>fs.readFileSync(dir+p,"utf8");
test("recognition-only diagnostic is explicit, bounded, provisioned and TEST-only",()=>{
 const launcher=read("Hu20-StartTestTerminal.ps1");
 const kiosk=read("Hu20-AutoKiosk.ps1");
 const cmd=read("Hu20-DIAGNOSTIC-TEST.cmd");
 assert.match(cmd,/\-AutoKioskTest \-RecognitionDiagnostic/);
 assert.match(launcher,/\[switch\]\$RecognitionDiagnostic/);
 assert.match(launcher,/\-RecognitionDiagnostic:\$RecognitionDiagnostic/);
 assert.match(kiosk,/\[switch\]\$RecognitionDiagnostic/);
 assert.match(kiosk,/\$diagnosticMaxSamples = 5/);
 assert.match(kiosk,/\$RecognitionDiagnostic -and \(\$FullScreenTest -or -not \$UseProvisionedDevice\)/);
 assert.match(kiosk,/\$preflight\.window\.scansRemaining/);
 assert.match(kiosk,/\$body\.kioskTestOnly/);
 assert.match(kiosk,/\$preflight\.realStaffPilot/);
});
test("recognition-only path cannot reach attendance POST even on unique match",()=>{
 const kiosk=read("Hu20-AutoKiosk.ps1");
 const start=kiosk.indexOf('if ($outcome -eq "one_match") {\n    if ($RecognitionDiagnostic)');
 const end=kiosk.indexOf('} # End attendance branch; RecognitionDiagnostic cannot reach punch API.',start);
 const attendance=kiosk.indexOf('Invoke-WebRequest -Uri "$base/api/staff-hu20/attendance"',start);
 assert.ok(start>0&&end>start&&attendance>start&&attendance<end,"Attendance POST stays behind negative diagnostic guard");
 assert.match(kiosk.slice(start,end),/\} else \{\s*Write-Host "PASS: CENTRAL_ONE_MATCH/);
 assert.equal((kiosk.match(/Invoke-WebRequest -Uri "\$base\/api\/staff-hu20\/attendance"/g)||[]).length,1);
 assert.match(kiosk,/\$accepted\.noAttendanceWasRecorded -ne \$true/);
});
test("SDK reports image quality transiently, with no diagnostics written to files or weakened match",()=>{
 const kiosk=read("Hu20-AutoKiosk.ps1");
 assert.match(kiosk,/GetImageQuality\(\$width, \$height, \$raw, \[ref\]\$measuredQuality\)/);
 assert.match(kiosk,/\[Array\]::Clear/);
 assert.match(kiosk,/MatchTemplate\(\$item\.Template, \$live, \[Enum\]::Parse\(\$levelType, "NORMAL"\)/);
 assert.match(kiosk,/\$Quality = 80/);
 assert.doesNotMatch(kiosk,/Set-Content|Out-File|Export-Csv|Start-Transcript/);
 const names=fs.readdirSync(dir).filter(x=>x.endsWith(".ps1"));
 for (const name of names) {
  const bytes=fs.readFileSync(dir+name);
  // Windows PS 5.1 decodes BOM-less scripts as ANSI: native scripts should be ASCII-safe.
  assert.ok([...bytes].every(x=>x<128),name+" includes non-ASCII codepage-sensitive characters");
 }
});
