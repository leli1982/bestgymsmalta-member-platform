import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/migrations/20261027_153000_offline_membership_sync.sql", import.meta.url), "utf8");

test("offline sync receipt is unique by client submission and server-only", () => {
  assert.match(migration, /create table if not exists public\.bgm_offline_membership_sync_receipts/i);
  assert.match(migration, /client_submission_id uuid not null unique/i);
  assert.match(migration, /result in \('activated', 'review_required', 'rejected'\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all[^;]+anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[^;]+service_role/i);
});

test("offline staging uses deterministic application identity and never allocates a BGM number", () => {
  assert.match(migration, /v_application_id uuid := v_client_submission_id/i);
  assert.match(migration, /application_source[\s\S]*'offline_staff'/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /md5\(v_client_submission_id::text \|\| ':' \|\| v_order::text\)::uuid/i);
  assert.doesNotMatch(migration, /bgm_next_member_number/i);
});

test("offline staging reserves cards only for clean auto-activation candidates", () => {
  assert.match(migration, /v_reserve_cards boolean/i);
  assert.match(migration, /if v_reserve_cards then/i);
  assert.match(migration, /bgm_member_card_credentials/i);
  assert.match(migration, /values \(v_card_value,null,v_participant_id,'reserved'/i);
});

test("final receipt writes an auditable terminal result", () => {
  assert.match(migration, /bgm_record_offline_membership_sync_receipt/i);
  assert.match(migration, /membership\.offline_sync\.' \|\| v_result/i);
  assert.match(migration, /source_payload jsonb/i);
});
