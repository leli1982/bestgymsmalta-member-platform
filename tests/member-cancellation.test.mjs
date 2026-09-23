import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateBarcodeAccess } from "../lib/barcodeAccessCore.ts";
import { evaluateNfcAccess } from "../lib/nfcAccessCore.ts";
import { classifyStaffMember } from "../lib/staffDashboardCore.ts";
import {
  resolveMemberCancellation, validateCancellationCommand, isCancellationEffective,
} from "../lib/memberCancellationCore.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const memberId = "00000000-0000-4000-8000-000000000123";
const membershipId = "00000000-0000-4000-8000-000000000456";
const today = "2026-09-23";
const base = {
  memberStatus: "active", membershipExpiry: "2026-12-31",
  cancellationEffectiveDate: null, today,
  memberships: [{
    id: membershipId, status: "active", expiry_date: "2026-12-31",
    updated_at: "2026-09-23T08:00:00.000Z", participantCount: 1,
  }],
};
const command = {
  action: "cancel", effectiveDate: "2026-10-15", reason: "Requested by member",
  membershipId, expectedMemberUpdatedAt: "2026-09-23T08:00:00.000Z",
  expectedMembershipUpdatedAt: "2026-09-23T08:00:00.000Z",
};

test("Malta effective date denies barcode and NFC on that day but not before", () => {
  assert.equal(isCancellationEffective("2026-09-24", "2026-09-23"), false);
  assert.equal(isCancellationEffective("2026-09-24", "2026-09-24"), true);
  for (const date of ["2026-09-23", "2026-09-24", "2026-09-25"]) {
    const member = { status: "active", membershipExpiry: "2026-12-31", cancellationEffectiveDate: "2026-09-24" };
    const granted = date === "2026-09-23";
    assert.equal(evaluateBarcodeAccess({ member, today: date }).granted, granted);
    assert.equal(evaluateNfcAccess({ card: { status: "active" }, member, today: date }).granted, granted);
    assert.equal(classifyStaffMember({ ...member, today: date }), granted ? "active" : "inactive");
  }
  assert.equal(evaluateBarcodeAccess({ member: { status: "active", membershipExpiry: "2026-09-22" }, today }).result, "expired");
});

test("only current unshared individual or legacy memberships can be cancelled", () => {
  assert.equal(resolveMemberCancellation(base).allowed, true);
  assert.equal(resolveMemberCancellation({ ...base, memberships: [] }).allowed, true);
  assert.equal(resolveMemberCancellation({ ...base, cancellationEffectiveDate: "2026-10-01" }).canWithdraw, true);
  assert.equal(resolveMemberCancellation({ ...base, cancellationEffectiveDate: "2026-09-23" }).allowed, false);
  assert.equal(resolveMemberCancellation({ ...base, memberships: [{ ...base.memberships[0], participantCount: 2 }] }).allowed, false);
  assert.equal(resolveMemberCancellation({ ...base, memberships: [...base.memberships, { ...base.memberships[0], id: memberId }] }).allowed, false);
  assert.equal(resolveMemberCancellation({ ...base, memberships: [{ ...base.memberships[0], expiry_date: "2026-11-01" }] }).allowed, false);
  assert.equal(resolveMemberCancellation({ ...base, memberStatus: "inactive" }).allowed, false);
  assert.equal(resolveMemberCancellation({ ...base, membershipExpiry: "2026-09-22" }).allowed, false);
});

test("cancellation payload whitelist rejects tampered identity, payments, expiry and invalid dates", () => {
  assert.equal(validateCancellationCommand(command).ok, true);
  assert.equal(validateCancellationCommand({ ...command, action: "withdraw", effectiveDate: null }).ok, true);
  assert.equal(validateCancellationCommand({ ...command, effectiveDate: "2026-02-30" }).ok, false);
  assert.equal(validateCancellationCommand({ ...command, membershipId: "not-a-uuid" }).ok, false);
  assert.equal(validateCancellationCommand({ ...command, reason: "X".repeat(501) }).ok, false);
  assert.equal(validateCancellationCommand({ ...command, action: "withdraw" }).ok, false);
  for (const field of ["memberNumber", "legacyPkCustomer", "membershipExpiry", "status", "cardBarcode", "price", "payment"]) {
    assert.equal(validateCancellationCommand({ ...command, [field]: "tamper" }).ok, false);
  }
});

test("Super Admin-only separate endpoint calls audited cancellation RPC and member GET resolves eligibility", () => {
  const route = read("app/api/system/admin/members/[memberId]/cancellation/route.ts");
  const memberRoute = read("app/api/system/admin/members/[memberId]/route.ts");
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /validateCancellationCommand\(await request\.json\(\)\)/);
  assert.match(route, /bgm_super_admin_member_cancellation/);
  assert.match(route, /p_expected_member_updated_at: validation\.expectedMemberUpdatedAt/);
  assert.match(memberRoute, /resolveMemberCancellation/);
  assert.match(memberRoute, /cancellationEdit/);
  assert.doesNotMatch(route, /\.from\("bgm_members"\)\.update\(/);
});

test("cancellation SQL is atomic, refuses shared membership, locks identity and audits both actions", () => {
  const sql = read("supabase/migrations/20260923_130000_super_admin_member_cancellation.sql");
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /from public\.bgm_members where id = p_member_id for update/);
  assert.match(sql, /v_participants <> 1/);
  assert.match(sql, /v_current_matches <> 1/);
  assert.match(sql, /v_member\.updated_at is distinct from p_expected_member_updated_at/);
  assert.match(sql, /v_membership\.updated_at is distinct from p_expected_membership_updated_at/);
  assert.match(sql, /Cancellation already took effect|Cancellation already took effect/i);
  assert.match(sql, /insert into public\.bgm_audit_log/);
  assert.match(sql, /member\.membership_cancellation\.withdraw/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /update public\.bgm_membership_applications|update public\.bgm_member_card_credentials|update public\.bgm_member_checkins|delete from/i);
  assert.doesNotMatch(sql, /set\s+member_number\s*=|set\s+membership_expiry\s*=|set\s+legacy_gym\s*=/i);
  assert.match(sql, /bgm_cancelled_member_checkin_guard/);
  assert.match(sql, /bgm_new_membership_clears_member_cancellation/);
});

test("all member access paths and staff lookups check the effective cancellation date", () => {
  const paths = [
    "app/api/system/barcode/scan/route.ts",
    "app/api/system/nfc/scan/route.ts",
    "app/api/checkins/route.ts",
    "app/api/member/auth/login/route.ts",
    "lib/memberPublicProfile.ts",
    "app/api/member/card/route.ts",
    "app/api/system/members/search/route.ts",
  ];
  for (const path of paths) {
    assert.match(read(path), /cancellation_effective_date/, path);
  }
  const editor = read("components/staff/SuperAdminMemberEditor.tsx");
  const panel = read("components/staff/SuperAdminMemberCancellation.tsx");
  assert.match(editor, /SuperAdminMemberCancellation/);
  assert.match(panel, /window\.confirm/);
  assert.match(panel, /Withdraw pending cancellation/);
  assert.match(panel, /Shared couples memberships cannot be cancelled/);
});
