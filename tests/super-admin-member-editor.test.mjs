import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMemberProfile, isRealDate, EDITABLE_PROFILE_FIELDS } from "../lib/superAdminMemberProfileCore.ts";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const goodProfile = Object.fromEntries(EDITABLE_PROFILE_FIELDS.map((key) => [key, ""]));
goodProfile.firstName = "Alex";
goodProfile.lastName = "Borg";
goodProfile.email = "alex@example.test";
goodProfile.dateOfBirth = "1988-02-29";

test("profile validation allows verified fields but never member ids, cards, status, dates or payments", () => {
  const valid = validateMemberProfile(goodProfile);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.profile.firstName, "Alex");
  for (const key of ["memberNumber", "legacyPkCustomer", "enrollmentGymId", "status", "membershipExpiry", "cardBarcode", "price", "notes"]) {
    assert.equal(validateMemberProfile({ ...goodProfile, [key]: "malicious" }).ok, false, key);
  }
  assert.equal(validateMemberProfile({ ...goodProfile, firstName: "" }).ok, false);
  assert.equal(validateMemberProfile({ ...goodProfile, dateOfBirth: "2025-02-29" }).ok, false);
  assert.equal(validateMemberProfile({ ...goodProfile, dateOfBirth: "2999-01-01" }).ok, false);
  assert.equal(validateMemberProfile({ ...goodProfile, email: "invalid" }).ok, false);
  assert.equal(isRealDate("2024-02-29"), true);
  assert.equal(isRealDate("2025-02-29"), false);
});

test("only Super Admin can load or patch member editor; PATCH calls atomic audit RPC", () => {
  const route = read("app/api/system/admin/members/[memberId]/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PATCH/);
  assert.equal((route.match(/requireSuperAdmin\(request\)/g) || []).length, 2);
  assert.match(route, /validateMemberProfile\(body\.profile\)/);
  assert.match(route, /bgm_super_admin_update_member_profile/);
  assert.match(route, /p_expected_updated_at: body\.expectedUpdatedAt/);
  assert.doesNotMatch(route, /\.from\("bgm_members"\)\.update\(/);
  assert.doesNotMatch(route, /\.from\("bgm_memberships"\)\.update\(/);
  assert.doesNotMatch(route, /\.from\("bgm_membership_applications"\)\.update\(/);
});

test("atomic profile RPC preserves identifiers and membership data and appends before/after audit", () => {
  const sql = read("supabase/migrations/20260923_090000_super_admin_member_profile_edit.sql");
  assert.match(sql, /is_super_admin = true/);
  assert.match(sql, /for update/);
  assert.match(sql, /v_before\.updated_at is distinct from p_expected_updated_at/);
  assert.match(sql, /insert into public\.bgm_audit_log/);
  assert.match(sql, /before_data, after_data/);
  assert.match(sql, /grant execute on function public\.bgm_super_admin_update_member_profile/);
  assert.match(sql, /to service_role/);
  for (const field of ["member_number", "legacy_pk_customer", "enrollment_gym_id", "membership_expiry", "official_photo_path"]) {
    assert.doesNotMatch(sql, new RegExp("set\\s+" + field + "\\s*="), field);
  }
});

test("Super Admin browser opens profile editor; member and payment contexts are read-only", () => {
  const browse = read("components/staff/StaffMemberBrowser.tsx");
  const tools = read("components/staff/SuperAdminMembershipTools.tsx");
  const editor = read("components/staff/SuperAdminMemberEditor.tsx");
  assert.match(tools, /StaffMemberBrowser canRenew canEdit/);
  assert.match(browse, /canEdit &&/);
  assert.match(browse, /\/staff\/admin\/members\//);
  assert.match(editor, /Save personal details/);
  assert.match(editor, /No linked membership transaction is recorded/);
  assert.match(editor, /not saved by the personal-details or enrollment-gym buttons/);
  assert.doesNotMatch(editor, /method: "DELETE"/);
});
