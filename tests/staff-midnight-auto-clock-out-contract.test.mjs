import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20261015_120000_staff_midnight_auto_clock_out.sql",
  import.meta.url,
);
const payrollSnapshotMigrationPath = new URL(
  "../supabase/migrations/20261016_140000_staff_midnight_payroll_snapshot.sql",
  import.meta.url,
);
const cronPath = new URL(
  "../app/api/cron/staff-midnight-auto-clock-out/route.ts",
  import.meta.url,
);
const vercelPath = new URL("../vercel.json", import.meta.url);

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";
const payrollSnapshotMigration = fs.existsSync(payrollSnapshotMigrationPath)
  ? fs.readFileSync(payrollSnapshotMigrationPath, "utf8")
  : "";
const cron = fs.existsSync(cronPath) ? fs.readFileSync(cronPath, "utf8") : "";
const vercel = fs.readFileSync(vercelPath, "utf8");

test("midnight migration supports immutable system evidence and reviewed sessions", () => {
  assert.match(migration, /source[^\n]*system/i);
  assert.match(migration, /reviewed/);
  assert.match(migration, /midnight_auto_clock_out/);
  assert.match(migration, /bgm_staff_attendance_alerts/);
  assert.match(migration, /bgm_staff_auto_close_midnight_sessions/);
});

test("midnight close records exact effective cutoff and leaves the session needing review", () => {
  assert.match(migration, /Europe\/Malta/);
  assert.match(migration, /effective_minute_timestamp/);
  assert.match(migration, /status\s*=\s*'needs_attention'/);
  assert.match(migration, /attention_code\s*=\s*'midnight_auto_clock_out'/);
  assert.match(migration, /clock_out_gym_id\s*=\s*null/);
});

test("midnight close is retry safe", () => {
  assert.match(migration, /staff-midnight-auto-clock-out:/);
  assert.match(migration, /on conflict\s*\(event_key\)\s*do nothing/i);
  assert.match(migration, /for update(?:\s+of\s+s)?\s+skip locked/i);
});

test("midnight auto-close persists the same historical payroll snapshot as a normal OUT punch", () => {
  assert.match(payrollSnapshotMigration, /create or replace function public\.bgm_staff_auto_close_midnight_sessions/i);
  assert.match(payrollSnapshotMigration, /bgm_staff_session_payroll_segments/i);
  assert.match(payrollSnapshotMigration, /bgm_staff_rate_history/i);
  assert.match(payrollSnapshotMigration, /bgm_staff_employment_type_history/i);
  assert.match(payrollSnapshotMigration, /bgm_staff_public_holiday_versions/i);
  assert.match(payrollSnapshotMigration, /holiday_multiplier_bps/i);
  assert.match(payrollSnapshotMigration, /hourly_rate_cents/i);
  assert.match(payrollSnapshotMigration, /worked_minutes/i);
  assert.match(payrollSnapshotMigration, /pay_cents/i);
  assert.match(payrollSnapshotMigration, /on conflict\s*\(session_id,\s*work_date\)\s*do nothing/i);
});

test("midnight payroll snapshot fails visibly when historical rate or employment data is missing", () => {
  assert.match(payrollSnapshotMigration, /missing_payroll_history/i);
  assert.match(payrollSnapshotMigration, /missing_rate/i);
  assert.match(payrollSnapshotMigration, /missing_employment/i);
  assert.match(payrollSnapshotMigration, /status\s*=\s*'needs_attention'/i);
});

test("midnight cron is secret protected and invokes only the atomic database function", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /authorization/i);
  assert.match(cron, /bgm_staff_auto_close_midnight_sessions/);
  assert.doesNotMatch(cron, /bgm_staff_work_sessions["']/);
});

test("Vercel triggers the midnight checker every hour so Malta DST needs no fixed UTC schedule", () => {
  assert.match(vercel, /staff-midnight-auto-clock-out/);
  assert.match(vercel, /"schedule"\s*:\s*"0 \* \* \* \*"/);
});
