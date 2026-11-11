import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

const sql=read("supabase/migrations/20261111_160000_voucher_super_admin_approval.sql");
const settingsUi=read("components/staff/MembershipSettingsAdmin.tsx");
const settingsApi=read("app/api/system/membership-settings/route.ts");
const staff=read("components/staff/StaffMembershipReviewModal.tsx");
const pending=read("components/staff/PendingMembershipActions.tsx");
const preview=read("app/api/system/members/applications/[applicationId]/discount/route.ts");
const activate=read("app/api/system/members/enroll/route.ts");
const decisions=read("app/api/system/voucher-approvals/route.ts");
const poll=read("app/api/system/members/applications/[applicationId]/voucher-approval/route.ts");
const select=read("components/staff/StaffVoucherSelect.tsx");
const home=read("components/staff/SuperAdminHome.tsx");
const admin=read("components/staff/VoucherApprovalsAdmin.tsx");
const push=read("lib/voucherApprovalPush.ts");
const end=read("lib/endOfDayCore.ts");
const pdf=read("lib/membershipFormPdf.ts");
const print=read("components/staff/StaffApplicationPrint.tsx");
const browser=read("tests/browser/staff-dashboard.mjs");

test("existing vouchers default to no verification and Super Admin is sole owner of the setting",()=>{
  assert.match(sql,/requires_verification boolean not null default false/i);
  assert.match(settingsUi,/Requires verification/);
  assert.match(settingsUi,/requiresVerification: discountDraft\.requiresVerification/);
  assert.match(settingsApi,/requireSuperAdmin\(request\)/);
  assert.match(settingsApi,/requires_verification: requiresVerification/);
  assert.match(settingsApi,/existingResult\.data\.requires_verification/);
  assert.match(select,/approval required/);
});
test("approval requests are per application and voucher terms, deduplicated and audited",()=>{
  assert.match(sql,/application_id uuid not null references public\.bgm_membership_applications/);
  assert.match(sql,/voucher_id uuid not null references public\.bgm_discount_codes/);
  assert.match(sql,/voucher_terms jsonb not null/);
  assert.match(sql,/status in \('pending','approved','rejected','cancelled'\)/);
  assert.match(sql,/bgm_voucher_approval_one_open_request_per_application/);
  assert.match(sql,/v_voucher\.max_uses is not null/);
  assert.match(sql,/v_existing\.status/);
  assert.match(sql,/voucher\.approval\.requested/);
  assert.match(sql,/voucher\.approval\.'\|\|v_decision/);
  assert.match(sql,/decision_note/);
});
test("direct database activation is blocked unless current terms have an approved request",()=>{
  assert.match(sql,/before update of status on public\.bgm_membership_applications/);
  assert.match(sql,/new\.status='activated'/);
  assert.match(sql,/new\.discount_code_id is not null/);
  assert.match(sql,/r\.status='approved'/);
  assert.match(sql,/r\.voucher_terms=public\.bgm_voucher_approval_terms\(v_voucher\)/);
  assert.match(sql,/Voucher requires Super Admin approval before activation/);
  assert.doesNotMatch(sql,/drop function.*bgm_activate_membership_application/i);
  assert.doesNotMatch(sql,/successful_uses\s*=\s*successful_uses\s*\+/i);
});
test("only Super Admin may approve; Staff cannot accept payment while awaiting approval",()=>{
  assert.match(decisions,/requireSuperAdmin\(request\)/g);
  assert.match(decisions,/bgm_decide_voucher_approval/);
  assert.match(poll,/requireSystemPermission\(request,"membership\.activate"\)/);
  assert.match(preview,/bgm_request_voucher_approval/);
  assert.match(preview,/sendVoucherApprovalPush/);
  for(const ui of [staff,pending]){
    assert.match(ui,/StaffVoucherApprovalStatus/);
    assert.match(ui,/discountPreview\??.*requiresVerification/s);
    assert.match(ui,/approvalStatus !== "approved"/);
    assert.match(ui,/PAYMENT RECEIVED — ACTIVATE/);
  }
  assert.match(browser,/voucherApproved/);
  assert.match(browser,/Staff must not activate a voucher pending Super Admin approval/);
  assert.match(home,/voucher-approvals/);
  assert.match(admin,/Approve/);
  assert.match(admin,/Reject/);
});
test("push targets enrolled active Super Admin devices only",()=>{
  assert.match(push,/bgm_push_subscriptions/);
  assert.match(push,/bgm_system_users/);
  assert.match(push,/user\.is_super_admin \|\| user\.role === "super_admin"/);
  assert.match(push,/\/staff\/admin\/voucher-approvals/);
});
test("existing activation, EOD reimbursement, member PDF and print routes are unchanged",()=>{
  assert.match(activate,/p_discount_code: discountCode \|\| null/);
  assert.match(end,/discountReimbursementCentsSnapshot/);
  assert.match(end,/voucherReimbursementCents \+= reimbursement/);
  assert.match(pdf,/application\.discountCode/);
  assert.match(print,/window\.print\(\)/);
  assert.doesNotMatch(sql,/alter table public\.bgm_membership_applications/i);
});
