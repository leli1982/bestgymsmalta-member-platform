import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveMemberDateEdit, validMembershipDate, validateMembershipDateEdit,
} from "../lib/memberDateEditCore.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const id = "00000000-0000-4000-8000-000000000123";
const base = {
  id, status: "active", start_date: "2026-09-01",
  expiry_date: "2026-10-01", updated_at: "2026-09-23T11:00:00.000Z", participantCount: 1,
};

test("legacy expiry corrections preserve unknown historical start dates", () => {
  const legacy = resolveMemberDateEdit("2026-10-01", null, []);
  assert.equal(legacy.allowed, true);
  assert.equal(legacy.startDate, "");
  assert.equal(legacy.membershipId, null);
  assert.match(legacy.reason, /verified start date/);
});
test("only an unambiguous current unshared record is eligible for a date correction", () => {
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [base]).membershipId, id);
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [base, { ...base, id: "00000000-0000-4000-8000-000000000124", expiry_date: "2026-09-01" }]).membershipId, id);
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [base, { ...base, id: "00000000-0000-4000-8000-000000000124" }]).allowed, false);
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [{ ...base, participantCount: 2 }]).allowed, false);
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [{ ...base, status: "cancelled" }]).allowed, false);
  assert.equal(resolveMemberDateEdit("2026-10-01", null, [{ ...base, expiry_date: "2026-09-01" }]).allowed, false);
  assert.equal(resolveMemberDateEdit(null, null, [base]).allowed, false);
});
test("date correction rejects arbitrary columns, invented calendar dates and invalid periods", () => {
  const good = {
    expectedMemberUpdatedAt: "2026-09-23T11:00:00.000Z",
    expectedMembershipUpdatedAt: base.updated_at,
    membershipId: id, startDate: "2026-09-01", expiryDate: "2026-10-01",
  };
  assert.equal(validMembershipDate("2024-02-29"), true);
  assert.equal(validMembershipDate("2026-02-29"), false);
  assert.equal(validateMembershipDateEdit(good).ok, true);
  assert.equal(validateMembershipDateEdit({ ...good, startDate: null }).ok, false);
  assert.equal(validateMembershipDateEdit({ ...good, startDate: "2026-11-01" }).ok, false);
  assert.equal(validateMembershipDateEdit({ ...good, expiryDate: "2026-02-29" }).ok, false);
  assert.equal(validateMembershipDateEdit({ ...good, membershipId: null, expectedMembershipUpdatedAt: null, startDate: null }).ok, true);
  for (const field of ["status", "price", "legacyGym", "memberNumber", "paymentAmount"]) {
    assert.equal(validateMembershipDateEdit({ ...good, [field]: "changed" }).ok, false);
  }
});
test("date correction route uses separate Super Admin-only RPC and a strict payload", () => {
  const route = read("app/api/system/admin/members/[memberId]/membership-dates/route.ts");
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /validateMembershipDateEdit\(await request.json\(\)\)/);
  assert.match(route, /bgm_super_admin_correct_member_dates/);
  assert.match(route, /p_expected_member_updated_at: validation.expectedMemberUpdatedAt/);
  assert.doesNotMatch(route, /\.from\("bgm_members"\)\.update\(/);
});
test("transactional RPC blocks shared or ambiguous memberships, preserves payment history and audits dates", () => {
  const sql = read("supabase/migrations/20260923_120000_super_admin_member_date_correction.sql");
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /v_participants <> 1/);
  assert.match(sql, /v_current_matches <> 1/);
  assert.match(sql, /v_membership\.updated_at is distinct from p_expected_membership_updated_at/);
  assert.match(sql, /v_member\.updated_at is distinct from p_expected_member_updated_at/);
  assert.match(sql, /if v_links = 0 then/);
  assert.match(sql, /insert into public\.bgm_audit_log/);
  assert.match(sql, /before_data, after_data/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /update public\.bgm_membership_applications|update public\.bgm_member_card_credentials|update public\.bgm_member_checkins|delete from/i);
  assert.doesNotMatch(sql, /set\s+member_number\s*=|set\s+legacy_gym\s*=/i);
});
test("date edit UI is its own action and never submits card/gym/profile fields", () => {
  const ui = read("components/staff/SuperAdminMemberEditor.tsx");
  assert.match(ui, /Save membership dates/);
  assert.match(ui, /detail\.dateEdit\.allowed/);
  assert.match(ui, /membership-dates/);
  assert.match(ui, /expectedMembershipUpdatedAt: detail\.dateEdit\.expectedMembershipUpdatedAt/);
  assert.match(ui, /Only enter a historically verified start date|actual date has been verified/);
  assert.match(ui, /shared membership/i);
});
