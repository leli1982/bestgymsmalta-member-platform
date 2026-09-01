import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901_123000_phase2_notifications.sql"
);

function migrationSql() {
  assert.equal(
    fs.existsSync(migrationPath),
    true,
    "Phase 2 notifications migration must exist"
  );
  return fs.readFileSync(migrationPath, "utf8");
}

test("notifications migration creates settings and push subscription tables with RLS", () => {
  const sql = migrationSql();

  for (const table of ["bgm_notification_settings", "bgm_push_subscriptions"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

test("order notification settings are configurable and default to the BGM info address", () => {
  const sql = migrationSql();
  assert.match(sql, /orders_email text not null/i);
  assert.match(sql, /email_enabled boolean not null default true/i);
  assert.match(sql, /push_enabled boolean not null default true/i);
  assert.match(sql, /info@bestgymsmalta\.com/i);
});

test("push subscriptions persist browser endpoint and encryption keys", () => {
  const sql = migrationSql();
  assert.match(sql, /endpoint text not null/i);
  assert.match(sql, /p256dh text not null/i);
  assert.match(sql, /auth text not null/i);
  assert.match(sql, /unique\s*\(endpoint\)/i);
  assert.match(sql, /system_user_id uuid not null references public\.bgm_system_users/i);
});
