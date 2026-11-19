import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const base = "native/Bgm.SecuGenHu20Probe/";
const read = (p) => fs.readFileSync(p, "utf8");
const watch = read(base + "Hu20-KioskWatch.ps1");
const manage = read(base + "Hu20-ManageKioskStartup.ps1");
const provisioning = read(base + "Hu20-ProvisionEasyEnrollment.ps1");
const preflight = read("app/api/staff-hu20/kiosk/preflight/route.ts");
const kiosk = read(base + "Hu20-AutoKiosk.ps1");

test("new Windows watcher never scans a fingerprint or creates an attendance event", () => {
  assert.match(watch, /TEST ONLY/);
  assert.match(watch, /Invoke-WebRequest -Uri "\$base\/api\/staff-hu20\/kiosk\/preflight"/);
  assert.match(watch, /-Method Get/);
  assert.match(watch, /-MaximumRedirection 0/);
  assert.match(watch, /Get-Hu20Vault -BaseUrl \$base -TerminalId \$id/);
  assert.match(watch, /'Authorization'='Bearer ' \+ \$terminalSecret/);
  assert.match(watch, /'x-vercel-protection-bypass'=\$vercelBypass/);
  assert.match(watch, /bestgymsmalta-member-platform-/);
  assert.match(watch, /Hu20-StartTestTerminal\.ps1/);
  assert.doesNotMatch(watch, /\/api\/staff-hu20\/(?:recognition\/(?:begin|finish)|attendance|enrollments)/);
  assert.doesNotMatch(watch, /GetImageEx|CreateTemplate|MatchTemplate|ScanFinger|Read-Host|Get-Credential/);
  assert.doesNotMatch(watch, /Start-Process[\s\S]*-ArgumentList \$args[\s\S]*-Verb RunAs/);
  assert.match(kiosk, /-EnableFictionalTestAttendance -AutoKioskTest/);
});

test("a supervised TEST window is required, and the same window is never auto-started twice", () => {
  assert.match(preflight, /window: \{ id: window\.id, expiresAt: window\.expires_at/);
  assert.match(preflight, /restartRequiresManualApproval: true/);
  assert.match(watch, /window\.id/);
  assert.match(watch, /result\.restartRequiresManualApproval -ne \$true/);
  assert.match(watch, /result\.recognitionAuthorisationConsumed -ne \$false/);
  assert.match(watch, /result\.attendanceRecorded -ne \$false/);
  assert.match(watch, /result\.terminal\.id -cne \$id/);
  assert.match(watch, /last-approved-kiosk-window\.json/);
  assert.match(watch, /Move-Item -LiteralPath \$tmp -Destination \$lastPath -Force/);
  assert.ok(
    watch.indexOf("Move-Item -LiteralPath $tmp -Destination $lastPath -Force") <
    watch.indexOf("Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru")
  );
  assert.match(watch, /Equals\(\$newId,\$lastId/);
  assert.match(watch, /if \(\$null -eq \$child -or \$child\.ExitCode -ne 0\)/);
  assert.match(watch, /No unattended retries/);
  assert.match(watch, /if \(\$status -eq 409\)/);
  assert.match(watch, /Start-Sleep -Seconds \$PollSeconds/);
  assert.match(watch, /Local\\BGM_HU20_TEST_KIOSK_WATCHER/);
  assert.doesNotMatch(watch, /-RepeatApprovedTests|-RecognitionDiagnostic|-UseProvisionedDevice:\$false/);
});

test("startup is technician opt-in, HKCU scoped and reversible, never changes reader setup", () => {
  assert.match(manage, /ValidateSet\('Status','Enable','Disable'\)/);
  assert.match(manage, /HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/);
  assert.match(manage, /BGM_HU20_TEST_KioskWatcher/);
  assert.match(manage, /& \$watcher -CheckOnly/);
  assert.match(manage, /Set-ItemProperty -Path \$runKey -Name \$runName/);
  assert.match(manage, /Remove-ItemProperty -Path \$runKey -Name \$runName/);
  assert.match(manage, /-StartupDelaySeconds 30/);
  assert.doesNotMatch(manage, /HKLM:|pnputil|Remove-Item\s+-Recurse|Remove-Hu20Vault|Set-Hu20Vault|Read-Host|Get-Credential|Uninstall/);
  assert.match(provisioning, /\[switch\]\$EnableKioskStartup/);
  assert.match(provisioning, /if \(\$EnableKioskStartup\)/);
  assert.match(provisioning, /& \$manager -Action Enable/);
  assert.match(provisioning, /BGM_HU20_TEST_LocalBridge/);
});

test("Windows PowerShell syntax check runs without starting the reader or modifying installation", () => {
  const check = read(base + "Hu20-WindowsStartupParseCheck.ps1");
  const cmd = read(base + "Hu20-CHECK-STARTUP-SCRIPTS-TEST.cmd");
  assert.match(check, /Language\.Parser\]::ParseFile/);
  assert.match(check, /Hu20-KioskWatch\.ps1/);
  assert.match(check, /Hu20-ManageKioskStartup\.ps1/);
  assert.match(cmd, /Hu20-WindowsStartupParseCheck\.ps1/);
  assert.doesNotMatch(check, /Start-Process|Set-ItemProperty|Remove-ItemProperty|GetImageEx|Invoke-WebRequest/);
});

test("Windows watcher remains strictly TEST; no automatic Production activation or attendance", () => {
  assert.match(watch, /TEST/);
  assert.match(watch, /'X-BGM-HU20-Kiosk-Test'='1'/);
  assert.match(watch, /VERCEL|bestgymsmalta-member-platform-/i);
  assert.match(watch, /-AutoKioskTest -FullScreenTest -RequireProvisionedDevice/);
  assert.match(read(base + "Hu20-StartTestTerminal.ps1"), /if \(\$RequireProvisionedDevice -and -not \$useVault\)/);
  assert.match(manage, /-NonInteractive/);
  assert.doesNotMatch(watch, /(?:bestgymsmalta-member-platform\.vercel\.app|jsuolemirhivqhjbjetv|https:\/\/bestgymsmalta\.com)/);
  assert.doesNotMatch(manage, /\/api\/staff-hu20\/attendance|member_password|terminalSecret\s*=/);
});
