import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260909_140000_membership_identity_exchange.sql",
    import.meta.url
  ),
  "utf8"
);

test("membership identity schema creates permanent BGM allocator", () => {
  assert.match(migration, /create table if not exists public\.bgm_member_number_state/i);
  assert.match(migration, /create or replace function public\.bgm_next_member_number/i);
  assert.match(migration, /BGM/i);
  assert.match(migration, /lpad/i);
});

test("legacy import can preserve blank or duplicate emails", () => {
  assert.match(migration, /alter column email drop not null/i);
  assert.match(migration, /drop constraint if exists bgm_members_email_key/i);
});

test("member import is staged before apply", () => {
  assert.match(migration, /bgm_member_import_batches/i);
  assert.match(migration, /bgm_member_import_rows/i);
  assert.match(migration, /row_number/i);
  assert.match(migration, /action/i);
});

test("access scan schema supports barcode credentials", () => {
  assert.match(migration, /credential_type/i);
  assert.match(migration, /credential_value/i);
  assert.match(migration, /barcode/i);
});

test("identity migration keeps new operational tables behind RLS", () => {
  for (const table of [
    "bgm_member_number_state",
    "bgm_member_import_batches",
    "bgm_member_import_rows",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i")
    );
  }
});
