import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20261015_120000_staff_midnight_auto_clock_out.sql",
  import.meta.url,
);
const cronPath = new URL(
  "../app/api/cron/staff-midnight-auto-clock-out/route.ts",
  import.meta.url,
);
const vercelPath = new URL("../vercel.json", import.meta.url);

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";
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
  assert.match(migration, /for update skip locked/i);
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
