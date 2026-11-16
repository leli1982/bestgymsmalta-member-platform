import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dir = "native/Bgm.SecuGenHu20Probe/";
const launcher = fs.readFileSync(dir + "Hu20-OpenLocalEnrollment.ps1", "utf8");
const shortcut = fs.readFileSync(dir + "Hu20-ENROLL-TEST.cmd", "utf8");
const page = fs.readFileSync("app/staff/admin/staff/terminals/enrollment/page.tsx", "utf8");
const ci = fs.readFileSync(".github/workflows/phase2-ci.yml", "utf8");

test("Windows TEST enrolment launcher checks the attached HU20 before selecting the PC terminal", () => {
  for (const s of ["Hu20-TestTerminal.local.json", "Hu20-Probe.ps1", "baseUrl", "terminalId", "sdkAssembly", "sgfplib.dll"])
    assert.ok(launcher.includes(s), s);
  assert.match(launcher, /& \$probePath -SdkAssembly \$sdkPath -Mode health/);
  assert.match(launcher, /Start-Process -FilePath \$enrollmentUrl/);
  assert.ok(launcher.indexOf("-Mode health") < launcher.indexOf("Start-Process -FilePath"));
  assert.match(launcher, /localTerminalId=/);
  assert.match(launcher, /EscapeDataString\(\$terminalId\)/);
  assert.match(launcher, /bestgymsmalta-member-platform-/);
  assert.match(launcher, /not terminal authentication/i);
  assert.doesNotMatch(launcher, /Invoke-WebRequest|Invoke-RestMethod|GetImageEx|CreateTemplate|Read-Host|Set-Content|Out-File|Bearer /i);
});

test("no reader or installed configuration means no silent last-online fallback", () => {
  assert.match(launcher, /No usable HU20 was verified on this PC/);
  assert.match(launcher, /The local JSON configuration is missing/);
  assert.match(shortcut, /Hu20-OpenLocalEnrollment\.ps1/);
  assert.match(shortcut, /if errorlevel 1/);
  assert.match(page, /data\.terminals\.find\(item => item\.active && item\.id === suggestedId\)/);
  assert.match(page, /select a registered terminal manually/);
  assert.doesNotMatch(page, /last_seen_at|sessionStorage\.getItem\("terminal/);
  assert.match(ci, /Hu20-OpenLocalEnrollment\.ps1/);
});
