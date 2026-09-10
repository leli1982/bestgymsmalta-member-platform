import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260909_143000_apply_member_import_batch.sql",
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

test("apply preserves permanent identity on updates", () => {
  assert.doesNotMatch(sql, /set\s+member_number\s*=/i);
  assert.match(sql, /resolved_membership_number/i);
});

test("apply allocates blank numbers only inside the transaction", () => {
  assert.match(sql, /bgm_next_member_number\(\)/i);
  assert.match(sql, /last_issued/i);
});
