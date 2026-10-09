import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationUrl = new URL("../supabase/migrations/20261009040000_google_wallet_membership_passes.sql", import.meta.url);
const migrationPath = fileURLToPath(migrationUrl);
assert.ok(existsSync(migrationPath), "C4 Google Wallet migration must exist before schema contract can pass");
const sql = readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ").toLowerCase();

test("Wallet mapping table is additive, one-per-member, unique per Google object and server managed", () => {
  assert.match(compact, /create table if not exists public\.bgm_google_wallet_passes/);
  assert.match(compact, /member_id uuid primary key references public\.bgm_members\(id\) on delete cascade/);
  assert.match(compact, /object_id text not null unique/);
  assert.match(compact, /class_id text not null/);
  assert.match(compact, /sync_status text not null default 'pending' check \(sync_status in \('pending','synced','failed'\)\)/);
  for (const column of ["last_attempt_at", "last_synced_at", "last_error", "created_at", "updated_at"]) {
    assert.match(compact, new RegExp(`\\b${column}\\b`));
  }
  assert.match(compact, /alter table public\.bgm_google_wallet_passes enable row level security/);
  assert.match(compact, /revoke all on table public\.bgm_google_wallet_passes from anon, authenticated, service_role/);
  assert.match(compact, /grant select, insert, update, delete on table public\.bgm_google_wallet_passes to service_role/);
});

test("member-state trigger only marks already-provisioned Wallet rows pending", () => {
  assert.match(compact, /create or replace function public\.bgm_mark_google_wallet_member_pending\(\)/);
  assert.match(compact, /update public\.bgm_google_wallet_passes set sync_status = 'pending'/);
  assert.match(compact, /where member_id = new\.id/);
  assert.match(compact, /create trigger bgm_google_wallet_member_pending/);
  for (const field of [
    "member_number",
    "full_name",
    "first_name",
    "last_name",
    "status",
    "membership_expiry",
    "cancellation_effective_date",
    "archived_at",
  ]) {
    assert.ok(compact.includes(field), `member trigger must watch ${field}`);
  }
  assert.doesNotMatch(compact, /insert into public\.bgm_google_wallet_passes/);
});

test("card lifecycle trigger marks both old and new member assignments pending", () => {
  assert.match(compact, /create or replace function public\.bgm_mark_google_wallet_card_pending\(\)/);
  assert.match(compact, /old\.member_id/);
  assert.match(compact, /new\.member_id/);
  assert.match(compact, /create trigger bgm_google_wallet_card_pending/);
  assert.match(compact, /after insert or update or delete on public\.bgm_member_card_credentials/);
});

test("database trigger layer performs no Google/network work", () => {
  assert.doesNotMatch(compact, /http_post|http_get|net\.http|pg_net|walletobjects\.googleapis\.com|pay\.google\.com/);
  assert.doesNotMatch(compact, /security definer/);
});
