import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/system/staff-hu20/attendance-log/route.ts", "utf8");
const ui = fs.readFileSync("app/staff/admin/staff/terminals/page.tsx", "utf8");

test("HU20 fictional punch audit is read-only, Super Admin-only, and triple-gated to TEST", () => {
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(route, /export async function (POST|PATCH|DELETE)/);
  assert.match(route, /isHu20TestRequestEnabled\(\)/);
  assert.match(route, /BGM_HU20_RECOGNITION_TEST_ENABLED/);
  assert.match(route, /BGM_HU20_ATTENDANCE_TEST_ENABLED/);
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /\.like\("event_key", "hu20-test:%"\)/);
  assert.match(route, /\.like\("id_number", "HU20-TEST-%"\)/);
  assert.doesNotMatch(route, /encrypted_template|templateBase64|credential_hash|terminalSecret/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
});

test("terminal management shows test punches without activating normal staff punch tile", () => {
  assert.match(ui, /\/api\/system\/staff-hu20\/attendance-log/);
  assert.match(ui, /Recent fictional TEST fingerprint punches/);
  assert.match(ui, /Clock IN/);
  assert.match(ui, /Clock OUT/);
  assert.match(ui, /formatEuropeanDateTime\(punch\.at\)/);
  assert.match(ui, /Staff Management → Timesheets/);
  assert.doesNotMatch(ui, /Fingerprint attendance and payroll changes remain disabled/);
  const staffHome = fs.readFileSync("components/staff/StaffDashboard.tsx", "utf8");
  assert.match(staffHome, /<Tile label="Punch Clock" icon=\{Clock3\} disabled \/>/);
});
