import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("retroactive voucher correction is Super Admin-only and creates a server-side refund alert", () => {
  const route = read("app/api/system/admin/members/[memberId]/voucher/route.ts");
  const sql = read("supabase/migrations/20261001_111500_super_admin_member_voucher_refunds.sql");
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /bgm_super_admin_apply_member_voucher/);
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /v_refund := v_application\.final_amount_cents - v_new_final/);
  assert.match(sql, /insert into public\.bgm_member_refund_alerts/);
  assert.match(sql, /member_first_name/);
  assert.match(sql, /member_last_name/);
  assert.match(sql, /member_id_number/);
  assert.match(sql, /member_mobile/);
  assert.match(sql, /Shared memberships require joint voucher correction/);
  assert.match(sql, /member\.voucher\.retroactive_applied/);
});

test("refund alerts are persistent and only Super Admin can load or mark them handled", () => {
  const route = read("app/api/system/refund-alerts/route.ts");
  const sql = read("supabase/migrations/20261001_111500_super_admin_member_voucher_refunds.sql");
  assert.equal((route.match(/requireSuperAdmin\(request\)/g) || []).length, 2);
  assert.match(route, /bgm_member_refund_alerts/);
  assert.match(route, /bgm_super_admin_mark_refund_handled/);
  assert.match(sql, /status text not null default 'pending'/);
  assert.match(sql, /member\.refund\.handled/);
  assert.match(sql, /enable row level security/);
});

test("member editor exposes available vouchers and refund preview without opening staff access", () => {
  const memberRoute = read("app/api/system/admin/members/[memberId]/route.ts");
  const editor = read("components/staff/SuperAdminMemberEditor.tsx");
  const correction = read("components/staff/SuperAdminMemberVoucherCorrection.tsx");
  assert.match(memberRoute, /bgm_discount_codes/);
  assert.match(memberRoute, /discount_code_snapshot/);
  assert.match(memberRoute, /participantCount/);
  assert.match(editor, /SuperAdminMemberVoucherCorrection/);
  assert.match(correction, /Refund that will be flagged/);
  assert.match(correction, /Shared\/couples memberships are protected/);
  assert.match(correction, /\/api\/system\/admin\/members\//);
});

test("refund alert email contains the required member contact and refund details", () => {
  const mailer = read("lib/memberRefundMailer.ts");
  for (const field of ["firstName", "lastName", "idNumber", "mobile", "voucherCode", "refundDueCents"]) {
    assert.match(mailer, new RegExp(field));
  }
  assert.match(mailer, /Refund Required/);
  assert.match(mailer, /The alert remains pending in Super Admin until marked handled/);
});

test("operations dashboard surfaces the persistent Super Admin refund queue", () => {
  const dashboard = read("components/staff/OperationsDashboardAdmin.tsx");
  const refunds = read("components/staff/SuperAdminRefundAlerts.tsx");
  assert.match(dashboard, /SuperAdminRefundAlerts/);
  assert.match(refunds, /Refunds required/);
  assert.match(refunds, /Mark refunded/);
  assert.match(refunds, /ID:/);
  assert.match(refunds, /Mobile:/);
});


test("legacy imported members can receive an audited voucher correction only after Super Admin confirms original amount paid", () => {
  const route = read("app/api/system/admin/members/[memberId]/voucher/route.ts");
  const editor = read("components/staff/SuperAdminMemberVoucherCorrection.tsx");
  const sql = read("supabase/migrations/20261001_130000_legacy_member_voucher_corrections.sql");
  assert.match(route, /correctionKind === "legacy"/);
  assert.match(route, /p_original_paid_cents/);
  assert.match(editor, /Original amount paid/);
  assert.match(editor, /Confirm amount & apply voucher/);
  assert.match(editor, /no historical amount is invented/i);
  assert.match(sql, /bgm_super_admin_apply_legacy_member_voucher/);
  assert.match(sql, /confirmed_original_paid_cents/);
  assert.match(sql, /transaction-backed membership/);
  assert.match(sql, /member\.voucher\.legacy_retroactive_applied/);
  assert.match(sql, /is_super_admin = true/);
});

test("legacy voucher corrections feed voucher analytics", () => {
  const analytics = read("app/api/system/voucher-analytics/route.ts");
  assert.match(analytics, /bgm_legacy_member_voucher_corrections/);
  assert.match(analytics, /legacyCorrections/);
  assert.match(analytics, /legacyMembers/);
  assert.match(analytics, /member_enrollment_date_snapshot/);
});
