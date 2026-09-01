import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_120000_phase2_operations_foundation.sql"
);

function migrationSql() {
  assert.equal(
    fs.existsSync(migrationPath),
    true,
    "Phase 2 operations migration must exist"
  );
  return fs.readFileSync(migrationPath, "utf8");
}

test("Phase 2 foundation migration declares required operational tables and RLS", () => {
  const sql = migrationSql();
  const tables = [
    "bgm_system_users",
    "bgm_user_permissions",
    "bgm_audit_log",
    "bgm_membership_applications",
    "bgm_membership_application_members",
    "bgm_memberships",
    "bgm_membership_members",
  ];

  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i")
    );
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i")
    );
  }
});

test("system accounts enforce case-insensitive usernames and one login per gym", () => {
  const sql = migrationSql();
  assert.match(sql, /bgm_system_users_username_lower_key/i);
  assert.match(sql, /on public\.bgm_system_users \(lower\(username\)\)/i);
  assert.match(sql, /bgm_system_users_one_login_per_gym_key/i);
  assert.match(
    sql,
    /on public\.bgm_system_users \(gym_id\)[\s\S]*where gym_id is not null/i
  );
});

test("membership applications constrain the approved types, durations, statuses and require staff name", () => {
  const sql = migrationSql();

  for (const value of ["single", "couples", "student"]) {
    assert.match(sql, new RegExp(`'${value}'`, "i"));
  }

  for (const value of [
    "1_week",
    "2_weeks",
    "1_month",
    "3_months",
    "6_months",
    "1_year",
  ]) {
    assert.match(sql, new RegExp(`'${value}'`, "i"));
  }

  for (const value of [
    "draft",
    "submitted",
    "awaiting_payment",
    "activated",
    "cancelled",
  ]) {
    assert.match(sql, new RegExp(`'${value}'`, "i"));
  }

  assert.match(sql, /staff_name text not null/i);
});

test("existing members are extended additively with enrollment/profile fields", () => {
  const sql = migrationSql();
  const columns = [
    "first_name",
    "last_name",
    "address_line_1",
    "address_line_2",
    "postcode",
    "id_number",
    "date_of_birth",
    "next_of_kin",
    "enrollment_gym_id",
    "official_photo_path",
  ];

  assert.match(sql, /alter table public\.bgm_members/i);

  for (const column of columns) {
    assert.match(
      sql,
      new RegExp(`add column if not exists ${column}\\b`, "i")
    );
  }
});
