import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/system/staff-hu20/attendance-log/route.ts", "utf8");
const ui = fs.readFileSync("app/staff/admin/staff/terminals/page.tsx", "utf8");

test("HU20 TEST punch audit is read-only, Super Admin-only and triple-gated", () => {
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(route, /export async function (POST|PATCH|DELETE)/);
  assert.match(route, /isHu20TestRequestEnabled\(\)/);
  assert.match(route, /BGM_HU20_RECOGNITION_TEST_ENABLED/);
  assert.match(route, /BGM_HU20_ATTENDANCE_TEST_ENABLED/);
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /hu20RealStaffPilotEnabled\(\)/);
  assert.match(route, /event_key\.like\.hu20-test:%/);
  assert.match(route, /event_key\.like\.hu20-pilot:%/);
  assert.match(route, /row\.id_number\?\.startsWith\("HU20-TEST-"\)/);
  assert.match(route, /person\.fictional && row\.event_key\?\.startsWith\("hu20-test:"\)/);
  assert.match(route, /pilotEnabled && !person\.fictional && row\.event_key\?\.startsWith\("hu20-pilot:"\)/);
  assert.doesNotMatch(route, /encrypted_template|templateBase64|credential_hash|terminalSecret/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
});

test("TEST terminal panel displays separately labelled fictional/pilot punches and preserves gym gating", () => {
  assert.match(ui, /\/api\/system\/staff-hu20\/attendance-log/);
  assert.match(ui, /Recent HU20 TEST fingerprint punches/);
  assert.match(ui, /individually Super Admin-approved real-staff TEST pilot employees/);
  assert.match(ui, /Production biometric attendance remains disabled/);
  assert.match(ui, /realStaffPilot \? "\(staff TEST pilot\)" : "\(fictional TEST\)"/);
  assert.match(ui, /Clock IN/);
  assert.match(ui, /Clock OUT/);
  assert.match(ui, /formatEuropeanDateTime\(punch\.at\)/);
  assert.match(ui, /Staff Management → Timesheets/);
  const home = fs.readFileSync("components/staff/StaffDashboard.tsx", "utf8");
  assert.match(home, /punchClockEnabled && <Tile label="Punch Clock"/);
  const capability = fs.readFileSync("app/api/staff-hu20/portal-capability/route.ts", "utf8");
  assert.match(capability, /isHu20TestRequestEnabled\(\)/);
  assert.match(capability, /hu20_punch_clock_enabled === true/);
});
