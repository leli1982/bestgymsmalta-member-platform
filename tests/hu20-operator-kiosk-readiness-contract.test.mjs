import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const info = read("app/staff/punch-clock/page.tsx");
const cmd = read("native/Bgm.SecuGenHu20Probe/Hu20-KIOSK-TEST.cmd");
const launcher = read("native/Bgm.SecuGenHu20Probe/Hu20-StartTestTerminal.ps1");
const kiosk = read("native/Bgm.SecuGenHu20Probe/Hu20-AutoKiosk.ps1");
const watcher = read("native/Bgm.SecuGenHu20Probe/Hu20-KioskWatch.ps1");

test("Staff web page never claims it is the running physical fingerprint kiosk", () => {
  assert.match(info, /Staff Punch Clock/);
  assert.match(info, /USE THE WINDOWS KIOSK/);
  assert.match(info, /Staff instructions — not the scanner/);
  assert.match(info, /PLACE FINGER/);
  assert.match(info, /approved TEST window/);
  assert.match(info, /physical scanner is plugged in or an approved kiosk window is running/);
  assert.match(info, /local helper only—not hardware availability/);
  assert.match(info, /browser screen does not scan fingerprints or record punches/);
  assert.doesNotMatch(info, /\/(api\/staff-hu20\/attendance|api\/staff-hu20\/recognition\/begin)/);
});

test("one-click manual Windows kiosk shortcut cannot request device codes from staff", () => {
  assert.match(cmd, /Hu20-StartTestTerminal\.ps1/);
  assert.match(cmd, /-AutoKioskTest -FullScreenTest -RequireProvisionedDevice/);
  assert.match(cmd, /existing encrypted TEST credentials/);
  assert.doesNotMatch(cmd, /Read-Host|vercel_share|Share link|Private credentials are requested/);
  assert.match(launcher, /if \(\$RequireProvisionedDevice -and \(-not \$BaseUrl -or -not \$TerminalId -or -not \$SdkAssembly\)\)/);
  assert.match(launcher, /if \(\$RequireProvisionedDevice -and -not \$useVault\)/);
  assert.ok(launcher.indexOf("if ($RequireProvisionedDevice -and (-not $BaseUrl") <
    launcher.indexOf('if (-not $BaseUrl) { $BaseUrl = Read-Host'));
  assert.match(kiosk, /if \(-not \$EnableFictionalTestAttendance -or -not \$AutoKioskTest/);
  assert.match(watcher, /-AutoKioskTest -FullScreenTest -RequireProvisionedDevice/);
});

test("first startup must still be deliberate and TEST only", () => {
  const manager = read("native/Bgm.SecuGenHu20Probe/Hu20-ManageKioskStartup.ps1");
  assert.match(manager, /if \(\$old -and \$old -cne \$command -and -not \$ReplaceExisting\)/);
  assert.match(manager, /& \$watcher -CheckOnly/);
  assert.match(manager, /'Status'/);
  assert.match(manager, /'Disable'/);
  assert.doesNotMatch(cmd, /-Verb RunAs|powershell\.exe.*-Configure|Set-Hu20Vault|start.*production/i);
  assert.doesNotMatch(info, /\.vercel\.app\/.*_vercel_share|terminalSecret|Vercel.*Bypass/i);
});
