import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migrationPath = "supabase/migrations/20261007_191500_phase_b_member_number_renumbering.sql";
const sql = readFileSync(join(root, migrationPath), "utf8");

function pos(fragment) {
  return sql.toLowerCase().indexOf(fragment.toLowerCase());
}

test("Phase B migration deterministically assigns BGM1000 upward by old number then UUID", () => {
  assert.match(sql, /create\s+temporary\s+table\s+phase_b_member_number_map/i);
  assert.match(sql, /row_number\s*\(\s*\)\s*over\s*\(\s*order\s+by/i);
  assert.match(sql, /substring\s*\(\s*member_number\s+from\s+'\^BGM\(\[0-9\]\{7\}\)\$'\s*\)::bigint/i);
  assert.match(sql, /id\s+asc/i);
  assert.match(sql, /'BGM'\s*\|\|\s*\(999\s*\+\s*rank\)/i);
  assert.doesNotMatch(sql, /create\s+table\s+.*old.*new.*member/i);
});

test("Phase B migration replaces fixed-width constraint allocator and immutability guard", () => {
  assert.match(sql, /drop\s+trigger\s+if\s+exists\s+bgm_enforce_permanent_member_number_trigger/i);
  assert.match(sql, /drop\s+constraint\s+if\s+exists\s+bgm_members_permanent_member_number_format_check/i);
  assert.match(sql, /\^BGM\[1-9\]\[0-9\]\{3,\}\$/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bgm_next_member_number/i);
  assert.match(sql, /last_issued\s*<\s*9223372036854775807/i);
  assert.match(sql, /return\s+'BGM'\s*\|\|\s*next_value::text/i);
  assert.match(sql, /drop\s+constraint\s+if\s+exists\s+bgm_member_number_state_last_issued_check/i);
  assert.match(sql, /check\s*\(\s*last_issued\s*>=\s*0\s*\)/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bgm_enforce_permanent_member_number/i);
  assert.match(sql, /before\s+insert\s+or\s+update\s+of\s+member_number/i);
});

test("Phase B migration updates the active bulk-import allocator to the same unpadded format", () => {
  assert.match(sql, /bgm_apply_member_import_batch/i);
  assert.match(sql, /pg_get_functiondef/i);
  assert.match(sql, /9999999/);
  assert.match(sql, /9223372036854775807/);
  assert.match(sql, /assigned_member_number/i);
  assert.match(sql, /regexp_replace|replace\s*\(/i);
  assert.match(sql, /bulk import allocator|bulk-import allocator/i);
});

test("Phase B migration rewrites import snapshots through member UUID links", () => {
  assert.match(sql, /update\s+public\.bgm_member_import_rows/i);
  assert.match(sql, /matched_member_id/i);
  assert.match(sql, /resolved_membership_number/i);
  assert.match(sql, /update\s+public\.bgm_member_import_review_items/i);
  assert.match(sql, /member_id/i);
  assert.match(sql, /member_number/i);
});

test("Phase B migration clears only approved TEST activity in foreign-key-safe order", () => {
  const flags = pos("delete from public.bgm_card_conflict_flags");
  const scans = pos("delete from public.bgm_access_scans");
  const reviews = pos("delete from public.bgm_card_conflict_reviews");
  const checkins = pos("delete from public.bgm_member_checkins");
  assert.ok(flags >= 0, "card conflict flags cleanup is required");
  assert.ok(scans > flags, "card conflict flags must be deleted before access scans");
  assert.ok(reviews > flags, "card conflict flags must be deleted before conflict reviews");
  assert.ok(checkins > scans, "access scans must be deleted before member check-ins");
  for (const table of [
    "bgm_audit_log",
    "bgm_member_stats",
    "bgm_member_notifications",
    "bgm_membership_reminder_log",
    "bgm_member_password_resets",
    "bgm_member_push_subscriptions",
  ]) {
    assert.match(sql, new RegExp(`delete\\s+from\\s+public\\.${table}`, "i"));
  }
  assert.doesNotMatch(sql, /delete\s+from\s+public\.bgm_members\b/i);
  assert.doesNotMatch(sql, /update\s+public\.bgm_members\s+set\s+legacy_pk_customer/i);
  assert.doesNotMatch(sql, /update\s+public\.bgm_member_card_credentials/i);
});

test("Phase B migration fails closed on mapping and post-migration invariant violations", () => {
  assert.match(sql, /raise\s+exception/i);
  assert.match(sql, /member\s+count/i);
  assert.match(sql, /duplicate/i);
  assert.match(sql, /continuous|continuity/i);
  assert.match(sql, /allocator/i);
  assert.match(sql, /old-format|old format/i);
  assert.match(sql, /lock\s+table\s+public\.bgm_members/i);
  assert.match(sql, /for\s+update/i);
});
