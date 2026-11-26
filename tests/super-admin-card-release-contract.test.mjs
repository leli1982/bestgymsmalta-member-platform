import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261125_170000_super_admin_card_release.sql");
const route = read("app/api/system/admin/card-management/route.ts");
const ui = read("components/staff/SuperAdminCardManagement.tsx");
const tools = read("components/staff/SuperAdminMembershipTools.tsx");
const config = read("lib/supabaseAdminConfig.ts");

test("release database contract: atomic, stale-safe and no member writes", () => {
  assert.match(sql, /security invoker set search_path = ''/i);
  assert.match(sql, /lock table[\s\S]*in share row exclusive mode nowait/i);
  assert.match(sql, /current_state is distinct from p_expected/i);
  assert.match(sql, /p_confirmed is distinct from true/i);
  assert.match(sql, /p_confirm_active is distinct from true/i);
  assert.match(sql, /status='reserved'/i);
  assert.match(sql, /bgm_pending_legacy_card_verifications/);
  assert.match(sql, /bgm_card_conflict_reviews/);
  assert.match(sql, /bgm_nfc_cards/);
  assert.match(sql, /legacy_pk_customer/);
  assert.match(sql, /update public\.bgm_member_card_credentials set barcode_value=archive_code,status='retired'/i);
  assert.match(sql, /membership\.card\.release/);
  assert.match(sql, /after_state->>'status'<>'available'/);
  assert.doesNotMatch(sql, /\b(delete\s+from|update)\s+public\.bgm_members\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.bgm_member_card_credentials\b/i);
});

test("release endpoint checks Super Admin on both methods and protects scoped conflicts", () => {
  assert.equal((route.match(/await requireSuperAdmin\(request\)/g) || []).length, 2);
  assert.equal((route.match(/scopedConflictCandidates\(barcode\)/g) || []).length, 2);
  assert.match(route, /body\?\.confirmed !== true/);
  assert.match(route, /p_expected: body\.expected/);
  assert.match(route, /p_confirm_active: body\.confirmActive === true/);
  assert.match(route, /private, no-store/);
});

test("release screen is isolated and requires active-card consent", () => {
  assert.match(tools, /tool === "cards" \? <SuperAdminCardManagement\/>/);
  assert.match(tools, /<StaffMemberBrowser canRenew canEdit isSuperAdmin/);
  assert.match(tools, /<StaffMembershipQueue\/>/);
  assert.match(ui, /result\.status === "active" && !confirmActive/);
  assert.match(ui, /expected: result/);
  assert.match(ui, /data\.status !== "available"/);
  assert.match(config, /"feature\/super-admin-card-release"/);
});
