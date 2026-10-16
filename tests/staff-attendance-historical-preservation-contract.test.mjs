import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20261015_123000_staff_attendance_historical_preservation.sql";

async function source(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("correction payroll rebuild reuses the original snapshot for an unchanged Malta work date", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create or replace function public\.bgm_staff_rebuild_session_payroll/i);
  assert.match(migration, /bgm_staff_session_payroll_segments/i);
  assert.match(migration, /v_existing_segment/i);
  assert.match(migration, /rate_history_id/i);
  assert.match(migration, /hourly_rate_cents/i);
  assert.match(migration, /employment_history_id/i);
  assert.match(migration, /employment_type/i);
  assert.match(migration, /holiday_version_id/i);
  assert.match(migration, /holiday_multiplier_bps/i);
  assert.match(migration, /worked_minutes/i);
  assert.match(migration, /pay_cents/i);
});

test("only a newly introduced Malta date resolves fresh effective-dated payroll configuration", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /if\s+v_existing_segment\.id\s+is\s+null/i);
  assert.match(migration, /bgm_staff_rate_history/i);
  assert.match(migration, /bgm_staff_employment_type_history/i);
  assert.match(migration, /bgm_staff_public_holidays/i);
  assert.match(migration, /Europe\/Malta/);
});

test("removed date portions are deleted only from derived segments after their old values are captured", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /payrollSegments/i);
  assert.match(migration, /before_data/i);
  assert.match(migration, /delete\s+from\s+public\.bgm_staff_session_payroll_segments/i);
  assert.match(migration, /work_date/i);
});

test("attendance adjustment and central audit snapshots include payroll segment history", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /jsonb_build_object\([\s\S]*['"]session['"][\s\S]*['"]payrollSegments['"]/i);
  assert.match(migration, /bgm_staff_attendance_adjustments/i);
  assert.match(migration, /bgm_audit_log/i);
  assert.match(migration, /staff\.attendance\.session_corrected/);
});

test("historical snapshot preservation does not mutate immutable punch evidence", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /update\s+public\.bgm_staff_punch_events/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.bgm_staff_punch_events/i);
});
