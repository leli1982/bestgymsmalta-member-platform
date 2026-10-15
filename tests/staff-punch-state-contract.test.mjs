import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20261015_121000_staff_punch_state.sql",
  import.meta.url,
);
const serverPath = new URL("../lib/staffAttendanceServer.ts", import.meta.url);

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";
const server = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, "utf8") : "";

test("atomic punch RPC locks employee state and is idempotent", () => {
  assert.match(migration, /create or replace function public\.bgm_staff_record_punch/i);
  assert.match(migration, /from public\.bgm_staff_employees[\s\S]*for update/i);
  assert.match(migration, /event_key/i);
  assert.match(migration, /duplicate_ignored/);
  assert.match(migration, /bgm_staff_punch_events/i);
});

test("terminal punches derive authoritative gym from the terminal and never from caller input", () => {
  assert.match(migration, /from public\.bgm_staff_terminals/i);
  assert.match(migration, /v_terminal\.gym_id/i);
  assert.doesNotMatch(migration, /p_gym_id[\s\S]*source\s*=\s*'terminal'/i);
  assert.match(migration, /inactive_terminal/);
});

test("punch transition preserves raw time, normalizes effective minute, and applies cooldown", () => {
  assert.match(migration, /source_timestamp/i);
  assert.match(migration, /date_trunc\('minute'/i);
  assert.match(migration, /effective_minute_timestamp/i);
  assert.match(migration, /interval\s+'\d+ seconds'/i);
});

test("punch engine respects Malta-midnight auto-close before deciding IN versus OUT", () => {
  assert.match(migration, /bgm_staff_auto_close_midnight_sessions/i);
  assert.match(migration, /clocked_in/);
  assert.match(migration, /clocked_out/);
  assert.match(migration, /clock_in_gym_id/i);
  assert.match(migration, /clock_out_gym_id/i);
});

test("clock-out payroll snapshots split by Malta date and preserve effective histories", () => {
  assert.match(migration, /Europe\/Malta/);
  assert.match(migration, /bgm_staff_rate_history/i);
  assert.match(migration, /bgm_staff_employment_type_history/i);
  assert.match(migration, /bgm_staff_public_holidays/i);
  assert.match(migration, /bgm_staff_public_holiday_versions/i);
  assert.match(migration, /bgm_staff_session_payroll_segments/i);
  assert.match(migration, /hourly_rate_cents/i);
  assert.match(migration, /employment_type/i);
  assert.match(migration, /holiday_multiplier_bps/i);
  assert.match(migration, /pay_cents/i);
});

test("missing payroll history is surfaced as needs attention instead of silently paying zero", () => {
  assert.match(migration, /needs_attention/i);
  assert.match(migration, /missing_(?:rate|employment|payroll)/i);
  assert.doesNotMatch(migration, /coalesce\([^\n]*hourly_rate_cents[^\n]*0/i);
});

test("punch RPC remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.bgm_staff_record_punch[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.bgm_staff_record_punch[\s\S]*to service_role/i,
  );
});

test("server wrapper delegates to the atomic RPC and returns typed safe outcomes", () => {
  assert.match(server, /recordStaffPunch/);
  assert.match(server, /bgm_staff_record_punch/);
  assert.match(server, /clocked_in/);
  assert.match(server, /clocked_out/);
  assert.match(server, /duplicate_ignored/);
  assert.match(server, /inactive_employee/);
  assert.match(server, /inactive_terminal/);
  assert.doesNotMatch(server, /hourlyRate|payCents|salary/i);
});
