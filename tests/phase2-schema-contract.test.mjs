import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const foundationMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_120000_phase2_operations_foundation.sql"
);

const operationsMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_130000_phase2_nfc_orders_offline.sql"
);

function readMigration(filePath, label) {
  assert.equal(fs.existsSync(filePath), true, `${label} migration must exist`);
  return fs.readFileSync(filePath, "utf8");
}

function foundationSql() {
  return readMigration(foundationMigrationPath, "Phase 2 operations foundation");
}

function operationsSql() {
  return readMigration(operationsMigrationPath, "Phase 2 NFC/orders/offline");
}

test("Phase 2 foundation migration declares required operational tables and RLS", () => {
  const sql = foundationSql();
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
  const sql = foundationSql();
  assert.match(sql, /bgm_system_users_username_lower_key/i);
  assert.match(sql, /on public\.bgm_system_users \(lower\(username\)\)/i);
  assert.match(sql, /bgm_system_users_one_login_per_gym_key/i);
  assert.match(
    sql,
    /on public\.bgm_system_users \(gym_id\)[\s\S]*where gym_id is not null/i
  );
});

test("membership applications constrain the approved types, durations, statuses and require staff name", () => {
  const sql = foundationSql();

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
  const sql = foundationSql();
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

test("NFC cards and access scans have explicit lifecycle and access-result contracts", () => {
  const sql = operationsSql();

  for (const table of ["bgm_nfc_cards", "bgm_access_scans"]) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i")
    );
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i")
    );
  }

  assert.match(sql, /card_uid text not null/i);
  assert.match(sql, /unique.*lower\(card_uid\)/is);
  assert.match(sql, /status in \('active', 'disabled', 'replaced'\)/i);

  for (const result of [
    "granted",
    "expired",
    "inactive",
    "unknown_card",
    "disabled_card",
  ]) {
    assert.match(sql, new RegExp(`'${result}'`, "i"));
  }

  assert.match(
    sql,
    /checkin_id uuid references public\.bgm_member_checkins\(id\)/i
  );
});

test("operational orders support sundries and bar lists with Staff Name attribution", () => {
  const sql = operationsSql();

  for (const table of ["bgm_operational_orders", "bgm_operational_order_items"]) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i")
    );
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i")
    );
  }

  assert.match(sql, /order_type in \('sundries', 'bar'\)/i);
  assert.match(sql, /staff_name text not null/i);

  for (const status of ["submitted", "ordered", "completed", "cancelled"]) {
    assert.match(sql, new RegExp(`'${status}'`, "i"));
  }
});

test("offline roster sync metadata tracks each gym computer without storing extra member PII", () => {
  const sql = operationsSql();

  assert.match(
    sql,
    /create table if not exists public\.bgm_offline_roster_syncs\b/i
  );
  assert.match(
    sql,
    /alter table public\.bgm_offline_roster_syncs enable row level security/i
  );

  for (const column of [
    "system_user_id",
    "gym_id",
    "device_id",
    "last_synced_at",
    "member_count",
    "roster_hash",
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"));
  }

  assert.doesNotMatch(sql, /email|phone|address_line|date_of_birth/i);
});
