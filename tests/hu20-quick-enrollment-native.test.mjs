import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dir="native/Bgm.SecuGenHu20Probe/";
const r=(p)=>fs.readFileSync(dir+p,"utf8");
const vault=r("Hu20-DeviceVault.ps1");
const setup=r("Hu20-ProvisionEasyEnrollment.ps1");
const bridge=r("Hu20-LocalBridge.ps1");
const scanner=r("Hu20-EnrollEmployee.ps1");
const ui=fs.readFileSync("components/staff/Hu20QuickEnrollment.tsx","utf8");

test("one-time TEST provisioning DPAPI-seals secrets to the correct Windows user",()=>{
  assert.match(vault, /DataProtectionScope\]::CurrentUser/);
  assert.match(vault, /ProtectedData\]::Protect/);
  assert.match(vault, /ProtectedData\]::Unprotect/);
  assert.match(vault, /device-credentials\.dpapi/);
  assert.match(setup, /Read-Host \$message -AsSecureString/);
  assert.match(setup, /Hu20-DeviceVault\.ps1/);
  assert.match(setup, /HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/);
  assert.match(setup, /Get-Hu20Vault -BaseUrl \$baseUrl -TerminalId \$terminalId/);
  assert.match(setup, /Hu20-LocalBridge\.ps1/);
  assert.doesNotMatch(setup, /Set-Content.*[Tt]erminalSecret|Set-Content.*[Vv]ercelBypass/);
});
test("loopback reader bridge never listens on other machines or leaks credentials",()=>{
  assert.match(bridge, /\[System\.Net\.IPAddress\]::Loopback/);
  assert.match(bridge, /port=8765/);
  assert.match(bridge, /headers\["origin"\] -cne \$baseUrl/);
  assert.match(bridge, /headers\["host"\] -cne "127\.0\.0\.1:\$port"/);
  assert.match(bridge, /x-bgm-hu20-bridge/);
  assert.match(bridge, /nonceExpires/);
  assert.match(bridge, /Get-Hu20Vault/);
  assert.match(bridge, /-UseProvisionedBridge -ExpectedRequestId \$requestId -ExpectedEmployeeId \$employeeId/);
  assert.match(bridge, /Access-Control-Allow-Private-Network: true/);
  assert.doesNotMatch(bridge, /0\.0\.0\.0|Any:\:|WriteAllBytes|Set-Content|Out-File/);
  assert.doesNotMatch(ui, /Bearer |terminalSecret|vercelBypass|_vercel_share/);
});
test("two matching TEST scans reuse encrypted vault without legacy credential prompts",()=>{
  assert.match(scanner, /\[switch\]\$UseProvisionedBridge/);
  assert.match(scanner, /Get-Hu20Vault -BaseUrl \$base -TerminalId \$TerminalId/);
  assert.match(scanner, /\$headers\["x-vercel-protection-bypass"\] = \$vercelBypass/);
  assert.match(scanner, /result\.enrollment\.id -cne \$ExpectedRequestId/);
  assert.match(scanner, /result\.enrollment\.employeeId -cne \$ExpectedEmployeeId/);
  assert.match(scanner, /Wait-Hu20FingerLift \$manager \$width \$height/);
  assert.match(scanner, /if \(\$UseProvisionedBridge\) \{/);
  assert.match(scanner, /if \(-not \$UseProvisionedBridge\)/);
  assert.match(scanner, /Three fingerprint placements matched/);
  assert.match(scanner, /attendanceEnabled -ne \$false/);
});
