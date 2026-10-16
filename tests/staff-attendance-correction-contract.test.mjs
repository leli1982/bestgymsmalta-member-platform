import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  migration: "supabase/migrations/20261015_122000_staff_attendance_corrections.sql",
  server: "lib/staffAttendanceServer.ts",
  manual: "app/api/system/staff-attendance/manual-punch/route.ts",
  session: "app/api/system/staff-attendance/sessions/[sessionId]/route.ts",
  midnight: "supabase/migrations/20261015_120000_staff_midnight_auto_clock_out.sql",
};

async function source(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("manual punch API is Super Admin only and requires employee, gym, timestamp and reason", async () => {
  const manual = await source(files.manual);
  assert.match(manual, /requireSuperAdmin\(request\)/);
  assert.match(manual, /employeeId/);
  assert.match(manual, /gymId/);
  assert.match(manual, /timestamp|punchAt/);
  assert.match(manual, /reason/);
  assert.match(manual, /recordStaffPunch/);
  assert.match(manual, /source:\s*["']manual["']/);
  assert.match(manual, /actorSystemUserId:\s*auth\.context\.systemUserId/);
  assert.match(manual, /manualReason:\s*reason/);
});

test("manual punch uses known active gym and does not bypass the shared state engine", async () => {
  const manual = await source(files.manual);
  assert.match(manual, /bgm_gyms/);
  assert.match(manual, /status/);
  assert.doesNotMatch(manual, /bgm_staff_punch_events[^\n]*\.insert|bgm_staff_work_sessions[^\n]*\.insert/i);
});

test("correction route is Super Admin only, requires a reason and delegates atomically", async () => {
  const session = await source(files.session);
  assert.match(session, /requireSuperAdmin\(request\)/);
  assert.match(session, /reason/);
  assert.match(session, /correctStaffAttendanceSession/);
  assert.match(session, /reviewMidnight/);
  assert.doesNotMatch(session, /bgm_staff_punch_events[^\n]*\.update|bgm_staff_punch_events[^\n]*\.delete/i);
});

test("correction transaction validates ordering, gyms and overlapping sessions", async () => {
  const migration = await source(files.migration);
  assert.match(migration, /create or replace function public\.bgm_staff_correct_session/i);
  assert.match(migration, /clock_out_at[\s\S]*(?:>|<=)[\s\S]*clock_in_at/i);
  assert.match(migration, /bgm_gyms/i);
  assert.match(migration, /overlap/i);
  assert.match(migration, /for update/i);
});

test("correction preserves raw punches and writes immutable adjustment plus central audit", async () => {
  const migration = await source(files.migration);
  assert.match(migration, /bgm_staff_attendance_adjustments/);
  assert.match(migration, /before_data/);
  assert.match(migration, /after_data/);
  assert.match(migration, /bgm_audit_log/);
  assert.match(migration, /staff\.attendance\.session_corrected/);
  assert.doesNotMatch(migration, /update\s+public\.bgm_staff_punch_events/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.bgm_staff_punch_events/i);
});

test("correction rebuilds only derived payroll segments from effective dated history", async () => {
  const migration = await source(files.migration);
  assert.match(migration, /bgm_staff_rebuild_session_payroll/);
  assert.match(migration, /delete\s+from\s+public\.bgm_staff_session_payroll_segments/i);
  assert.match(migration, /bgm_staff_rate_history/i);
  assert.match(migration, /bgm_staff_employment_type_history/i);
  assert.match(migration, /bgm_staff_public_holidays/i);
  assert.match(migration, /Europe\/Malta/);
});

test("midnight auto-close immediately rebuilds payroll while remaining needs-attention", async () => {
  const migration = await source(files.migration);
  assert.match(migration, /create or replace function public\.bgm_staff_auto_close_midnight_sessions/i);
  assert.match(migration, /bgm_staff_rebuild_session_payroll/);
  assert.match(migration, /midnight_auto_clock_out/);
  assert.match(migration, /needs_attention/);
});

test("reviewing an unchanged midnight auto-close marks reviewed and resolves its alert", async () => {
  const migration = await source(files.migration);
  assert.match(migration, /reviewed/);
  assert.match(migration, /reviewed_at/);
  assert.match(migration, /reviewed_by_system_user_id/);
  assert.match(migration, /bgm_staff_attendance_alerts/);
  assert.match(migration, /status\s*=\s*'resolved'/);
  assert.match(migration, /staff\.attendance\.midnight_reviewed/);
});

test("server wrapper exposes correction RPC without exposing raw punch mutation", async () => {
  const server = await source(files.server);
  assert.match(server, /correctStaffAttendanceSession/);
  assert.match(server, /bgm_staff_correct_session/);
  assert.doesNotMatch(server, /bgm_staff_punch_events/);
});
