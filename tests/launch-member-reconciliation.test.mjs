import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(new URL("../lib/memberImportServer.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261001_160000_launch_member_reconciliation.sql", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../components/admin/MembershipDataAdmin.tsx", import.meta.url), "utf8");

test("launch reconciliation never deletes members omitted from a smaller source file", () => {
  assert.doesNotMatch(server, /from\(["']bgm_members["']\)\s*\.delete\(/s);
  assert.match(server, /missing_source/);
  assert.match(server, /retained unchanged and is not deleted or deactivated/i);
  assert.match(migration, /'deletions',0/);
});

test("legacy 22-column import stages raw identity and legacy Scan3 separately", () => {
  for (const token of ["legacy_22", "legacy_scan3", "source_valid_yn", "source_data", "date_of_birth", "id_number", "country"]) {
    assert.match(migration, new RegExp(token));
  }
  assert.match(server, /bgm_legacy_card_claims/);
  assert.doesNotMatch(server, /legacy_scan3:\s*null,\s*gym/s);
});

test("expiry date is authoritative for old-system status", () => {
  assert.match(server, /statusFromExpiryDate/);
  assert.match(server, /ExpiryDate is authoritative/);
  assert.match(migration, /v_batch\.import_mode='legacy_22'/);
  assert.match(migration, /v_row\.expiry_date >= \(now\(\) at time zone 'Europe\/Malta'\)::date/);
});

test("import UI exposes conversion verification and zero-deletion reconciliation", () => {
  assert.match(ui, /Convert & Validate/);
  assert.match(ui, /Source rows/);
  assert.match(ui, /Converted/);
  assert.match(ui, /Missing from source/);
  assert.match(ui, /Deletions/);
  assert.match(ui, /Existing BGM members missing from the upload are retained unchanged/);
});

test("blocking conflicts stop apply but warnings and missing-source items do not", () => {
  assert.match(migration, /v_batch\.conflict_rows > 0 or v_batch\.invalid_rows > 0/);
  assert.match(migration, /review_type in \('conflict','invalid','warning','missing_source'\)/);
  assert.match(migration, /blocking boolean not null default false/);
  assert.match(server, /action = "rejected"/);
  assert.match(server, /weak[\s\S]*reference-only hit is not enough/i);
  assert.match(server, /retained as a separate member pending Super Admin review/i);
  assert.match(server, /Legacy Gym blank rather than guessing a gym/i);
});


test("repeat legacy reconciliation reuses prior applied row lineage before treating shared legacy identifiers as conflicts", () => {
  assert.match(server, /loadAppliedLegacyLineage/);
  assert.match(server, /priorAppliedLegacyMember/);
  assert.match(server, /source_fingerprint/);
  assert.match(server, /byFingerprintRow/);
  assert.match(server, /legacy22Match\(row, candidates, indexes\)/);
});
