import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(p)=>fs.readFileSync(p,"utf8");
const preflight=read("app/api/staff-hu20/kiosk/preflight/route.ts");
const auto=read("native/Bgm.SecuGenHu20Probe/Hu20-AutoKiosk.ps1");
const display=read("native/Bgm.SecuGenHu20Probe/Hu20-KioskDisplay.ps1");
const panel=read("components/staff/Hu20TestKioskWindowsPanel.tsx");
test("old native kiosk fails closed if real staff pilot is enabled",()=>{
  assert.match(preflight,/fictionalTestOnly: !hu20RealStaffPilotEnabled\(\)/);
  assert.match(preflight,/realStaffPilot: hu20RealStaffPilotEnabled\(\)/);
  assert.match(auto,/\$fictionalMode = \(\$preflight\.fictionalTestOnly -eq \$true/);
  assert.match(auto,/\$pilotMode = \(\$preflight\.realStaffPilot -eq \$true/);
  assert.match(auto,/-not \(\$fictionalMode -xor \$pilotMode\)/);
});
test("UI identifies TEST pilot separately, never presents it as Production",()=>{
  assert.match(auto,/Set-Hu20KioskMode -Enabled \$pilotMode/);
  assert.match(display,/STAFF PILOT TEST  \|  NOT PRODUCTION/);
  assert.match(display,/function Set-Hu20KioskMode/);
  assert.match(display,/FICTIONAL TEST ONLY/);
  assert.match(panel,/realStaffPilotEnabled === true/);
  assert.match(panel,/controlled staff TEST pilot/);
});
