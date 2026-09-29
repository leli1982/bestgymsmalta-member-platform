import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCouplesCancellation, validateCouplesCancellationCommand } from "../lib/memberCancellationCore.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const memberId = "00000000-0000-4000-8000-000000000123";
const partnerId = "00000000-0000-4000-8000-000000000124";
const contractId = "00000000-0000-4000-8000-000000000456";
const context = {
  memberStatus: "active", partnerStatus: "active",
  memberExpiry: "2026-12-31", partnerExpiry: "2026-12-31",
  membershipExpiry: "2026-12-31", membershipStatus: "active",
  memberEffectiveDate: null, partnerEffectiveDate: null,
  membershipEffectiveDate: null, today: "2026-09-23",
  memberCurrentMatches: 1, partnerCurrentMatches: 1,
};
const command = {
  action: "cancel", effectiveDate: "2026-10-15", reason: "Requested jointly",
  membershipId: contractId, partnerId,
  expectedMemberUpdatedAt: "2026-09-23T09:00:00Z",
  expectedPartnerUpdatedAt: "2026-09-23T09:01:00Z",
  expectedMembershipUpdatedAt: "2026-09-23T09:02:00Z",
};
test("two active people and one shared current contract are required", () => {
  assert.equal(resolveCouplesCancellation(context).allowed, true);
  for (const change of [
    { partnerStatus: "inactive" }, { memberStatus: "inactive" },
    { memberExpiry: "2026-11-01" }, { partnerExpiry: "2026-11-01" },
    { memberCurrentMatches: 2 }, { partnerCurrentMatches: 0 },
    { membershipStatus: "cancelled" }, { membershipExpiry: "2026-09-22" },
    { partnerEffectiveDate: "2026-10-15" },
    { memberEffectiveDate: "2026-09-23", partnerEffectiveDate: "2026-09-23", membershipEffectiveDate: "2026-09-23" },
  ]) assert.equal(resolveCouplesCancellation({ ...context, ...change }).allowed, false, JSON.stringify(change));
  const pending = { ...context, memberEffectiveDate: "2026-10-15",
    partnerEffectiveDate: "2026-10-15", membershipEffectiveDate: "2026-10-15" };
  assert.equal(resolveCouplesCancellation(pending).canWithdraw, true);
  assert.equal(resolveCouplesCancellation({ ...pending, today: "2026-10-15" }).canWithdraw, false);
});
test("joint request whitelist requires partner and all three immutable version checks", () => {
  assert.equal(validateCouplesCancellationCommand(command).ok, true);
  assert.equal(validateCouplesCancellationCommand({ ...command, action: "withdraw", effectiveDate: null }).ok, true);
  for (const bad of [
    { ...command, membershipId: "invalid" }, { ...command, partnerId: "" },
    { ...command, expectedPartnerUpdatedAt: "" }, { ...command, effectiveDate: "2026-02-30" },
    { ...command, action: "withdraw" }, { ...command, status: "inactive" },
    { ...command, payment: "free" }, { ...command, reason: "X".repeat(501) },
  ]) assert.equal(validateCouplesCancellationCommand(bad).ok, false, JSON.stringify(bad));
});
test("later migration labels immediate and future joint cancellation distinctly without rewriting past audit events", () => {
  const auditMigration = read("supabase/migrations/20260923_150000_couples_immediate_cancellation_audit.sql");
  assert.ok(auditMigration.includes("p_effective_date = v_today then 'member.couples_cancellation.immediate'"));
  assert.ok(auditMigration.includes("when p_action = 'cancel' then 'member.couples_cancellation.schedule'"));
  assert.ok(auditMigration.includes("else 'member.couples_cancellation.withdraw'"));
  assert.ok(auditMigration.includes("revoke all on function public.bgm_super_admin_couples_cancellation"));
  assert.ok(auditMigration.includes("to service_role"));
  assert.doesNotMatch(auditMigration, /update public\\.bgm_audit_log|delete from public\\.bgm_audit_log/i);
});

test("joint endpoint enforces server super admin and one audited DB transaction", () => {
  const route = read("app/api/system/admin/members/[memberId]/couples-cancellation/route.ts");
  const sql = read("supabase/migrations/20260923_140000_super_admin_couples_cancellation.sql");
  const get = read("app/api/system/admin/members/[memberId]/route.ts");
  const ui = read("components/staff/SuperAdminCouplesCancellation.tsx");
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /validateCouplesCancellationCommand\(await request\.json\(\)\)/);
  assert.match(route, /bgm_super_admin_couples_cancellation/);
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /p_expected_partner_updated_at/);
  assert.match(sql, /v_person\.updated_at is distinct from/);
  assert.match(sql, /v_current_matches <> 1/);
  assert.match(sql, /count\(\*\).*public\.bgm_membership_members/s);
  assert.match(sql, /where id = any\(v_ids\) order by id for update/);
  assert.match(sql, /insert into public\.bgm_audit_log/);
  assert.match(sql, /bgm_couples_pending_renewal_guard/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /update public\.bgm_membership_applications|update public\.bgm_member_checkins|delete from/i);
  assert.match(get, /resolveCouplesCancellation/);
  assert.match(get, /couplesCancellationEdit/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /partner\.memberNumber/);
  assert.match(ui, /otherEditsPending/);
  assert.match(ui, /Withdraw BOTH pending cancellations/);
  assert.match(read("components/staff/SuperAdminMemberEditor.tsx"), /SuperAdminCouplesCancellation/);
});
