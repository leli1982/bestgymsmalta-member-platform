import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260910_115000_member_import_card_barcode.sql",
    import.meta.url
  ),
  "utf8"
);

test("apply rejects batches with unresolved rows", () => {
  assert.match(sql, /conflict/i);
  assert.match(sql, /invalid/i);
  assert.match(sql, /raise exception/i);
});

test("apply processes rows in workbook order", () => {
  assert.match(sql, /order by row_number/i);
});

test("apply never deletes members", () => {
  assert.doesNotMatch(sql, /delete\s+from\s+public\.bgm_members/i);
});

test("apply links supplied card barcodes through the credential lifecycle", () => {
  assert.match(sql, /card_barcode/i);
  assert.match(sql, /bgm_member_card_credentials/i);
  assert.match(sql, /status\s*,\s*activated_at/i);
  assert.match(sql, /'active'/i);
});

test("blank CardBarcode never allocates a generated BGM number", () => {
  assert.doesNotMatch(sql, /bgm_next_member_number\s*\(/i);
  assert.doesNotMatch(sql, /lpad\s*\(/i);
  assert.doesNotMatch(sql, /\^BGM/i);
});

test("import refuses card replacement and leaves it to the dedicated workflow", () => {
  assert.match(sql, /already has a different active card/i);
  assert.match(sql, /already issued or reserved/i);
});

test("new CardBarcode apply function remains service-role only", () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function[\s\S]*from public/i);
  assert.match(sql, /from anon/i);
  assert.match(sql, /from authenticated/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
});
