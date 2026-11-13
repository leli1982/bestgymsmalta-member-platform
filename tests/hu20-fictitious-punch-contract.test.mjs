import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const path = "app/api/staff-hu20/attendance/route.ts";
const api = fs.readFileSync(path, "utf8");
const sql = fs.readFileSync("supabase/migrations/20261113_140000_hu20_fictional_test_attendance.sql", "utf8");
const newScript = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-TestPunch.ps1", "utf8");
const oldScript = fs.readFileSync("native/Bgm.SecuGenHu20Probe/Hu20-CentralRecognise.ps1", "utf8");

test("attendance requires its own Preview/TEST flag and authenticated terminal", () => {
  assert.match(api, /BGM_HU20_ATTENDANCE_TEST_ENABLED/);
  assert.match(api, /BGM_HU20_RECOGNITION_TEST_ENABLED/);
  assert.match(api, /isHu20TestRequestEnabled/);
  assert.match(api, /authenticateHu20Terminal\(request\)/);
  assert.match(api, /bgm_hu20_test_record_attendance/);
  assert.match(api, /validHu20TerminalId/);
  assert.doesNotMatch(api, /export async function GET/);
});

test("database consumes a single confirmed fictitious test result atomically", () => {
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /attendance_consumed_at IS NOT NULL/);
  assert.match(sql, /completed_at < now\(\) - interval '90 seconds'/);
  assert.match(sql, /r\.result <> 'one_match'/);
  assert.match(sql, /r\.terminal_id <> p_terminal_id/);
  assert.match(sql, /FOR SHARE OF b/);
  assert.match(sql, /b\.status = 'enrolled'/);
  assert.match(sql, /e\.id_number LIKE 'HU20-TEST-%'/);
  assert.match(sql, /'hu20-test:' \|\| r\.id::text/);
  assert.match(sql, /bgm_staff_record_punch/);
  assert.match(sql, /bgm_audit_log/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /TO service_role/);
});

test("separate opt-in HU20 helper keeps the old recognition-only script untouched", () => {
  assert.match(newScript, /\$EnableFictionalTestAttendance/);
  assert.match(newScript, /api\/staff-hu20\/attendance/);
  assert.match(newScript, /fictionalTestOnly/);
  assert.match(newScript, /CENTRAL_ONE_MATCH/);
  assert.match(newScript, /Clear-Bytes \$live/);
  assert.match(newScript, /Clear-Bytes \$item\.Template/);
  assert.match(oldScript, /PUNCH DISABLED/);
  assert.doesNotMatch(oldScript, /api\/staff-hu20\/attendance/);
});
