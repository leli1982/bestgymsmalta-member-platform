import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = file => fs.readFileSync(file, "utf8");

test("Staff allowlist excludes membership term, DOB, status, card and payment fields", () => {
  const core = read("lib/staffMemberPersonalDetailsCore.ts");
  const fieldDeclaration = core.split("STAFF_PERSONAL_DETAIL_FIELDS = [")[1].split("] as const")[0];
  const allowed = [...fieldDeclaration.matchAll(/"([a-zA-Z0-9]+)"/g)].map(match => match[1]);
  assert.deepEqual(allowed, [
    "firstName","lastName","idNumber","addressLine1","addressLine2",
    "town","postcode","country","mobile","phone","telephoneNo1",
    "telephoneNo2","email","nextOfKin",
  ]);
  for (const forbidden of ["membershipExpiry","startDate","expiryDate","duration","dateOfBirth","status","cardBarcode","price","paymentMethod","enrollmentGymId"]) {
    assert.ok(!allowed.includes(forbidden), forbidden + " must not be editable by gym staff");
  }
  assert.match(core, /keys\.length !== STAFF_PERSONAL_DETAIL_FIELDS\.length/);
  assert.match(core, /Only approved personal and contact details may be edited/);
});

test("Staff RPC independently verifies actor, checks optimistic version and audits edits", () => {
  const sql = read("supabase/migrations/20261118_180000_staff_personal_details_only.sql");
  assert.match(sql, /bgm_staff_update_member_personal_details/);
  assert.match(sql, /v_actor\.role/);
  assert.match(sql, /v_actor\.gym_id/);
  assert.match(sql, /v_actor\.active|active = true/);
  assert.match(sql, /g\.status = 'active'/);
  assert.match(sql, /p_expected_updated_at/);
  assert.match(sql, /v_before\.updated_at IS DISTINCT FROM p_expected_updated_at/);
  assert.match(sql, /jsonb_object_keys\(p_profile\)/);
  assert.match(sql, /member\.profile\.staff_update/);
  assert.match(sql, /before_data,after_data/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /TO service_role/);

  const update = sql.split("UPDATE public.bgm_members SET")[1].split("WHERE id = p_member_id")[0];
  for (const forbidden of [
    "membership_expiry", "enrollment_date", "membership_period", "enrollment_gym_id",
    "date_of_birth", "status", "access_scope", "card", "barcode", "price",
    "payment", "member_number", "legacy_pk_customer",
  ]) {
    assert.doesNotMatch(update, new RegExp("\\b" + forbidden + "\\b","i"), "Unsafe staff update: " + forbidden);
  }
});

test("Staff API rejects extra fields and uses restricted RPC, never Super Admin mutation", () => {
  const api = read("app/api/system/members/[memberId]/personal-details/route.ts");
  assert.match(api, /requireSystemPermission\(request, "members\.edit"\)/);
  assert.match(api, /Object\.keys\(body\)\.sort\(\)\.join\(","\) !== "expectedUpdatedAt,profile"/);
  assert.match(api, /validateStaffPersonalDetails\(payload\.profile\)/);
  assert.match(api, /rpc\("bgm_staff_update_member_personal_details"/);
  assert.doesNotMatch(api, /rpc\("bgm_super_admin_update_member_profile"/);
});

test("Member search leads staff to restricted editor and keeps card replacement separately guarded", () => {
  const dashboard = read("components/staff/StaffDashboard.tsx");
  const browser = read("components/staff/StaffMemberBrowser.tsx");
  const editor = read("components/staff/StaffMemberPersonalDetailsEditor.tsx");
  const permissions = read("lib/systemPermissions.ts");
  assert.match(permissions, /GYM_STAFF_PERMISSIONS = \[[\s\S]*?"members\.edit"/);
  assert.match(dashboard, /canEdit=\{can\("members\.edit"\)\}/);
  assert.match(browser, /EDIT MEMBER \/ REPLACE CARD/);
  assert.match(browser, /\/staff\/members\/\$\{encodeURIComponent\(selected\.id\)\}\/edit/);
  assert.match(editor, /STAFF_PERSONAL_DETAIL_FIELDS/);
  assert.match(editor, /REPLACE PHYSICAL CARD/);
  assert.match(editor, /\/staff\/reception\/issue-card\?memberNumber=/);
  assert.match(read("app/api/system/members/card/replace/route.ts"), /requireSystemPermission\(request, "cards\.replace"\)/);
});

test("All staff action errors appear at submission controls and registration button is visible", () => {
  const registration = read("components/membership/RegistrationForm.tsx");
  const renewal = read("components/staff/StaffRenewalEnrollmentPage.tsx");
  const review = read("components/staff/StaffMembershipReviewModal.tsx");
  const eod = read("components/staff/EndOfDayPage.tsx");
  assert.match(registration, /formError \|\| \(mode === "staff" && externalError\)/);
  assert.match(registration, /mode === "staff" \? "bg-\[#ff5a0a\]/);
  assert.match(renewal, /aria-live="assertive"/);
  assert.match(review, /aria-live="assertive"/);
  assert.match(eod, /aria-live="assertive"/);
});

test("End of Day print is one A4-oriented ink-saving summary after success, with reprint", () => {
  const eod = read("components/staff/EndOfDayPage.tsx");
  const bridge = read("components/staff/EndOfDayPrintBridge.tsx");
  assert.match(eod, /bgm-eod-print-only/);
  assert.match(eod, /PRINT \/ REPRINT A4 END OF DAY/);
  for (const amount of ["report.memberships","report.renewals","report.barSalesCents",
    "report.grossCents","report.expensesTotalCents","report.dailyTotalCents"]) {
    assert.ok(eod.includes(amount));
  }
  assert.match(eod, /additional bar items: see digital report/);
  assert.match(bridge, /size: A4 portrait/);
  assert.match(bridge, /print-color-adjust: economy/);
  assert.match(bridge, /bgm:end-of-day-submitted/);
  assert.doesNotMatch(bridge, /MutationObserver/);
});

test("BGM member number appears on the first reserved copy and remains available for activated reprints", () => {
  const printable = read("lib/printableMembershipApplication.ts");
  const review = read("components/staff/StaffMembershipReviewModal.tsx");
  const print = read("components/staff/StaffApplicationPrint.tsx");
  const sheet = read("components/staff/MembershipA4Sheet.tsx");
  assert.match(printable, /memberNumber: member\?\.member_number \|\| \(!application\.activated_at/);
  assert.match(print, /reserve-numbers/);
  assert.match(sheet, /BGM member number \(reserved\)/);
  assert.doesNotMatch(sheet, /Assigned on activation/);
  // First print already includes the reserved number. The final activation
  // screen must offer FINISH, not a redundant second printing instruction.
  assert.doesNotMatch(review, /PRINT APPLICATION WITH BGM NUMBER/);
  assert.doesNotMatch(review, /Print an updated copy for the member records/);
  assert.match(review, />FINISH<\/button>/);
  // Keep the underlying activated-copy print layout available for legacy forms.
  assert.match(print, /activatedCopy = Boolean\(application\.activatedAt\)/);
});
