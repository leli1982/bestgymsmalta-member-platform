import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20261006_120000_staff_attendance_payroll.sql",
  "utf8"
);

const tables = [
  "bgm_staff_employees",
  "bgm_staff_employment_type_history",
  "bgm_staff_rate_history",
  "bgm_staff_public_holidays",
  "bgm_staff_public_holiday_versions",
  "bgm_staff_terminals",
  "bgm_staff_biometrics",
  "bgm_staff_punch_events",
  "bgm_staff_work_sessions",
  "bgm_staff_session_payroll_segments",
  "bgm_staff_attendance_adjustments",
];

test("staff attendance migration creates the complete dedicated schema", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, "i"));
  }
  assert.match(sql, /employment_type\s+text\s+not null\s+check\s*\(employment_type\s+in\s*\('full_time',\s*'part_time'\)\)/i);
  assert.match(sql, /hourly_rate_cents\s+integer\s+not null\s+check\s*\(hourly_rate_cents\s*>=\s*0\)/i);
  assert.match(sql, /full_time_multiplier_bps\s+integer\s+not null\s+check\s*\(full_time_multiplier_bps\s*>\s*0\)/i);
  assert.match(sql, /part_time_multiplier_bps\s+integer\s+not null\s+check\s*\(part_time_multiplier_bps\s*>\s*0\)/i);
});

test("employee identity and effective-dated histories are constrained", () => {
  assert.match(sql, /create unique index[^;]+lower\s*\(btrim\(id_number\)\)/is);
  assert.match(sql, /unique\s*\(employee_id,\s*effective_from\)/i);
  assert.match(sql, /bgm_staff_rate_history[^;]+unique\s*\(employee_id,\s*effective_from\)/is);
  assert.match(sql, /bgm_staff_public_holidays[^;]+holiday_date\s+date\s+not null\s+unique/is);
});

test("only one open non-void work session is allowed per employee", () => {
  assert.match(sql, /create unique index[^;]+bgm_staff_work_sessions[^;]+employee_id[^;]+where\s+clock_out_at\s+is\s+null[^;]+status\s*<>\s*'void'/is);
});

test("punch events are protected as immutable evidence", () => {
  assert.match(sql, /create or replace function public\.bgm_staff_reject_punch_event_mutation/i);
  assert.match(sql, /before update or delete on public\.bgm_staff_punch_events/i);
  assert.match(sql, /raise exception[^;]+immutable/is);
});

test("all staff attendance tables use RLS and deny direct public access", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant (?:all|select|insert|update|delete)[^;]* on public\\.${table} to service_role`, "i"));
  }
});

test("staff photos use a private dedicated storage bucket", () => {
  assert.match(sql, /bgm-staff-photos/);
  assert.match(sql, /public\s*\)\s*values\s*\([^;]*false/is);
});

test("biometric schema does not store raw fingerprint images", () => {
  const match = sql.match(/create table(?: if not exists)? public\.bgm_staff_biometrics\s*\(([\s\S]*?)\);/i);
  assert.ok(match, "biometric table must exist");
  assert.doesNotMatch(match[1], /raw_fingerprint|fingerprint_image|photo/i);
  assert.match(match[1], /encrypted_template|template_reference/i);
});
