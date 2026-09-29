import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";
import { evaluateNfcAccess } from "../lib/nfcAccessCore.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("archived accounts cannot enter with barcode or NFC even with a valid membership and card", () => {
  const member = { status: "archived", membershipExpiry: "2027-12-31", cancellationEffectiveDate: null };
  assert.equal(evaluateBarcodeAccess({ member, today: "2026-09-23" }).granted, false);
  assert.equal(evaluateNfcAccess({ member, card: { status: "active" }, today: "2026-09-23" }).granted, false);
  assert.match(read("app/api/member/auth/login/route.ts"), /member\.status !== "active"/);
  assert.match(read("app/api/checkins/route.ts"), /member\.status !== "active"/);
  assert.match(read("app/api/member/card/route.ts"), /memberResult\.data\.status === "archived"/);
});

test("account-status endpoints and archive browser are Super Admin-only", () => {
  const status = read("app/api/system/admin/members/[memberId]/account-status/route.ts");
  const del = read("app/api/system/admin/members/[memberId]/delete/route.ts");
  const archived = read("app/api/system/admin/members/archived/route.ts");
  assert.match(status, /requireSuperAdmin\(request\)/);
  assert.equal((del.match(/requireSuperAdmin\(request\)/g) || []).length, 2);
  assert.match(archived, /requireSuperAdmin\(request\)/);
  assert.match(status, /isMemberUuid\(memberId\)/);
  assert.equal((del.match(/isMemberUuid\(memberId\)/g) || []).length, 2);
  assert.match(status, /bgm_super_admin_member_archive_restore/);
  assert.match(del, /bgm_super_admin_member_delete_assessment/);
  assert.match(del, /bgm_super_admin_member_delete/);
  assert.match(status, /p_expected_updated_at: body\.expectedUpdatedAt/);
  assert.match(del, /p_confirmed_member_number: body\.confirmedMemberNumber/);
  const adminTools = read("components/staff/SuperAdminMembershipTools.tsx");
  assert.match(adminTools, /SuperAdminArchivedMembers/);
  assert.match(adminTools, /result\.user\?\.isSuperAdmin/);
  const panel = read("components/staff/SuperAdminMemberAccountActions.tsx");
  assert.match(panel, /Check permanent-delete eligibility/);
  assert.match(panel, /confirmedNumber !== member\.memberNumber/);
  assert.match(panel, /window\.confirm/);
  assert.match(panel, /otherEditsPending/);
  assert.doesNotMatch(read("components/staff/StaffMemberBrowser.tsx"), /SuperAdminMemberAccountActions|SuperAdminArchivedMembers/);
});

test("staff search excludes archived people from browsing, exact number, card and all fuzzy matches", () => {
  const search = read("app/api/system/members/search/route.ts");
  assert.ok((search.match(/\.neq\("status", "archived"\)/g) || []).length >= 10);
  assert.match(search, /\.eq\("member_number", exactMemberNumber\)\s*\.neq\("status", "archived"\)/);
  assert.match(search, /\.in\("id", cardMemberIds\)\s*\.neq\("status", "archived"\)/);
  const archive = read("app/api/system/admin/members/archived/route.ts");
  assert.match(archive, /\.eq\("status", "archived"\)/);
});

test("archive restore is atomic, audited, version-controlled and cannot undo cancellation", () => {
  const sql = read("supabase/migrations/20260923_160000_super_admin_member_archive_restore.sql");
  assert.match(sql, /is_super_admin=true/);
  assert.match(sql, /where id=p_member_id for update/);
  assert.match(sql, /updated_at is distinct from p_expected_updated_at/);
  assert.match(sql, /ms\.membership_type='couples' and ms\.status='active'/);
  assert.match(sql, /archived_previous_status=status/);
  assert.match(sql, /v_before\.cancellation_effective_date>v_today/);
  assert.match(sql, /ms\.status='cancelled'/);
  assert.match(sql, /'member\.account\.archive'/);
  assert.match(sql, /'member\.account\.restore'/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /delete from public\.bgm_members|update public\.bgm_memberships|update public\.bgm_member_checkins/i);
  const guard = read("supabase/migrations/20260923_180000_archived_member_access_guard.sql");
  assert.match(guard, /new\.archived_at is not null and new\.status <> 'archived'/);
  assert.match(guard, /bgm_archived_member_link_guard/);
});

test("permanent deletion refuses any linked contract, visits, photo, cards and audit history", () => {
  const sql = read("supabase/migrations/20260923_170000_super_admin_member_guarded_delete.sql");
  for (const table of [
    "bgm_membership_members", "bgm_membership_application_members", "bgm_member_card_credentials",
    "bgm_nfc_cards", "bgm_member_official_photos", "bgm_member_import_rows",
    "bgm_access_scans", "bgm_member_checkins", "bgm_member_stats", "bgm_audit_log",
  ]) assert.match(sql, new RegExp("public\\." + table), table);
  assert.match(sql, /for update/);
  assert.match(sql, /p_confirmed_member_number/);
  assert.match(sql, /p_expected_updated_at/);
  assert.match(sql, /v_assessment->>'eligible' <> 'true'/);
  assert.match(sql, /revoke all on function public\.bgm_super_admin_member_delete/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /delete from public\.bgm_memberships|delete from public\.bgm_audit_log/);
});
