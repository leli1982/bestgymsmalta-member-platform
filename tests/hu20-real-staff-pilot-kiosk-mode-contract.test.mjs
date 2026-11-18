import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(path, "utf8");
const panel = read("components/staff/Hu20TestKioskWindowsPanel.tsx");
const attendance = read("app/api/staff-hu20/attendance/route.ts");
const roster = read("app/api/staff-hu20/recognition/begin/route.ts");
const kiosk = read("native/Bgm.SecuGenHu20Probe/Hu20-AutoKiosk.ps1");
const launcher = read("native/Bgm.SecuGenHu20Probe/Hu20-KIOSK-TEST.cmd");
test("Super Admin TEST panel accepts exactly one pilot mode, never an ambiguous response",()=>{
  assert.match(panel,/result\.fictionalTestOnly === true && result\.realStaffPilotEnabled === false/);
  assert.match(panel,/result\.fictionalTestOnly === false && result\.realStaffPilotEnabled === true/);
  assert.match(panel,/Controlled staff TEST pilot approved/);
});
test("Server and native kiosk negotiate the same TEST mode before scanning",()=>{
  assert.match(roster,/realStaffPilot: pilotRoster/);
  assert.match(kiosk,/\$body\.realStaffPilot -ne \$pilotMode/);
  assert.match(attendance,/testOnly: true/);
  assert.match(attendance,/fictionalTestOnly: !hu20RealStaffPilotEnabled\(\)/);
  assert.match(attendance,/realStaffPilot: hu20RealStaffPilotEnabled\(\)/);
  assert.match(kiosk,/\$testPunch\.testOnly -ne \$true/);
  assert.match(kiosk,/\$testPunch\.fictionalTestOnly -ne \$fictionalMode/);
  assert.match(kiosk,/\$testPunch\.realStaffPilot -ne \$pilotMode/);
  assert.match(kiosk,/STAFF PILOT TEST PUNCH/);
  assert.doesNotMatch(launcher,/AUTOMATIC FICTIONAL TEST KIOSK/);
  assert.match(launcher,/NOT PRODUCTION/);
});
