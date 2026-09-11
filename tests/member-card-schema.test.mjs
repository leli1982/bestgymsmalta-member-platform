import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cardMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260910_111000_member_card_credentials.sql", import.meta.url),
  "utf8"
);
const cleanupMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260910_111500_member_number_card_compatibility_cleanup.sql", import.meta.url),
  "utf8"
);
const photoMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260910_112000_member_photo_provenance.sql", import.meta.url),
  "utf8"
);

test("card schema owns exact globally unique barcode credentials with lifecycle state", () => {
  assert.match(cardMigration, /create table if not exists public\.bgm_member_card_credentials/i);
  assert.match(cardMigration, /barcode_value text not null/i);
  assert.match(cardMigration, /unique \(barcode_value\)/i);
  assert.match(cardMigration, /status in \('reserved', 'active', 'retired'\)/i);
  assert.match(cardMigration, /one_active_per_member/i);
  assert.match(cardMigration, /one_reserved_per_application_member/i);
  assert.match(cardMigration, /retired_reason/i);
});

test("new operational members no longer depend on automatic BGM number allocation", () => {
  assert.match(cardMigration, /alter column member_number drop default/i);
  assert.match(cardMigration, /alter column member_number drop not null/i);
  assert.match(cleanupMigration, /drop constraint if exists bgm_members_member_number_key/i);
});

test("card credentials are server-only behind RLS", () => {
  assert.match(cardMigration, /enable row level security/i);
  assert.match(cardMigration, /revoke all on table public\.bgm_member_card_credentials from anon, authenticated/i);
});

test("official photo provenance supports the approved private-photo sources", () => {
  assert.match(photoMigration, /bgm_member_official_photos/i);
  for (const source of ["legacy_import", "new_membership", "renewal", "reception_capture"]) {
    assert.match(photoMigration, new RegExp(source));
  }
  assert.match(photoMigration, /exactly_one_target/i);
  assert.match(photoMigration, /enable row level security/i);
  assert.match(photoMigration, /revoke all on table public\.bgm_member_official_photos from anon, authenticated/i);
});
