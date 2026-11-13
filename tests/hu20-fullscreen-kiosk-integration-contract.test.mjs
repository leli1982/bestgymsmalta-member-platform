import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const root="native/Bgm.SecuGenHu20Probe/";
const script=fs.readFileSync(root+"Hu20-AutoKiosk.ps1","utf8");
const launcher=fs.readFileSync(root+"Hu20-StartTestTerminal.ps1","utf8");
const cmd=fs.readFileSync(root+"Hu20-KIOSK-TEST.cmd","utf8");
const display=fs.readFileSync(root+"Hu20-KioskDisplay.ps1","utf8");
const legacy=fs.readFileSync(root+"Hu20-TestPunch.ps1","utf8");

test("full-screen Windows visual mode is only enabled by the separate TEST launcher",()=>{
  assert.match(cmd,/-STA -ExecutionPolicy Bypass/);
  assert.match(cmd,/-AutoKioskTest -FullScreenTest/);
  assert.match(launcher,/\[switch\]\$FullScreenTest/);
  assert.match(launcher,/-FullScreenTest:\$FullScreenTest/);
  assert.match(script,/Missing Hu20-KioskDisplay[.]ps1/);
  assert.match(script,/Initialize-Hu20KioskDisplay/);
  assert.match(script,/Close-Hu20KioskDisplay/);
  assert.doesNotMatch(legacy,/Hu20-KioskDisplay|FullScreenTest/);
});

test("only centrally accepted fictional TEST attendance produces visual punch success",()=>{
  const attendance=script.indexOf('Invoke-WebRequest -Uri "$base/api/staff-hu20/attendance"');
  const validated=script.indexOf('TEST attendance transition was not confirmed.');
  const clockIn=script.indexOf('Show-Hu20KioskStatus -State "clock_in"');
  const clockOut=script.indexOf('Show-Hu20KioskStatus -State "clock_out"');
  assert.ok(attendance>0&&validated>attendance&&clockIn>validated&&clockOut>validated);
  assert.match(script,/Show-Hu20KioskStatus -State "verifying"/);
  assert.match(script,/Show-Hu20KioskStatus -State "rejected"/);
  assert.match(script,/Show-Hu20KioskStatus -State "finished"/);
  assert.match(script,/Show-Hu20KioskStatus -State "error"/);
  assert.match(display,/CLOCKED IN/);
  assert.match(display,/CLOCKED OUT/);
});

test("ESC or missing UI prevents invisible punches; UI stays responsive in scan loop",()=>{
  assert.match(cmd,/-STA/);
  assert.match(display,/Keys\]::Escape/);
  assert.match(display,/KIOSK_DISPLAY_CLOSED/);
  assert.match(script,/\$pollMs = if \(\$FullScreenTest\) \{ \[Math\]::Min\(\$CaptureTimeoutMs, 2000\) \}/);
  assert.match(script,/if \(\$FullScreenTest\) \{ Assert-Hu20KioskDisplay \}/);
  assert.match(script,/if \(\$FullScreenTest\) \{ Show-Hu20KioskStatus -State "remove" \}/);
  assert.match(script,/if \(\$FullScreenTest -and \$displayStarted\) \{ Close-Hu20KioskDisplay \}/);
  assert.match(script,/Wait-Hu20KioskUi -Milliseconds 10000/);
  assert.doesNotMatch(display,/HttpListener|NamedPipe|Set-Content|Out-File|Invoke-WebRequest/);
});

test("TEST URL updates no longer revert when launching the CMD shortcut",()=>{
  assert.match(launcher,/\$saveSettings/);
  assert.match(launcher,/\$config.baseUrl -cne \$BaseUrl/);
  assert.match(launcher,/baseUrl = \$BaseUrl/);
  assert.doesNotMatch(launcher,/password\s*=|token\s*=|terminalSecret\s*=/i);
});
