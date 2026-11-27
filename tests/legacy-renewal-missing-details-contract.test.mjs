import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = source("supabase/migrations/20261123_200000_legacy_renewal_missing_identity_nonblocking.sql");
const route = source("app/api/system/members/enroll/route.ts");
const ui = source("components/staff/StaffRenewalEnrollmentPage.tsx");

test("renewals preserve selected permanent member despite blank legacy ID", () => {
  assert.match(migration, /v_application_kind = 'renewal'/);
  assert.match(migration, /new\.existing_member_id IS NULL/);
  assert.match(migration, /new\.matched_member_id := v_selected\.id/);
  assert.match(migration, /v_selected\.archived_at|archived_at IS NULL/);
  assert.match(migration, /v_existing_id <> '' AND v_input_id <> ''/);
  assert.match(migration, /m\.id <> v_selected\.id/);
  assert.match(migration, /different BGM member/);
  assert.match(migration, /FOR KEY SHARE/);
});

test("NEW memberships retain active-identity block and required data", () => {
  assert.match(migration, /v_application_kind = 'new'/);
  assert.match(migration, /bgm_classify_membership_identity\(new\.id_number\)/);
  assert.match(migration, /An active membership already exists/);
  assert.match(route, /if \(kind === "new" \|\| kind === "renewal"\)/);
  for (const field of ["id_number", "address_line_1", "town", "phone", "email", "next_of_kin"]) {
    assert.ok(route.includes('["' + field + '",'), "New member must require " + field);
  }
});

test("staff renewal requires missing mandatory legacy details before submission", () => {
  assert.match(ui, /LEGACY_RENEWAL_DETAILS/);
  assert.match(ui, /Missing information in this legacy membership record/);
  assert.match(ui, /Complete all missing mandatory details before submitting the renewal/);
  assert.match(ui, /if \(missingDetails\.length\)/);
  assert.doesNotMatch(ui, /required=\{kind === "new"\}/);
  assert.match(ui, /originallyRecordedDob/);
  assert.match(ui, /readOnly=\{kind === "renewal" && Boolean\(originallyRecordedDob\)\}/);
  assert.match(route, /actualBirth \|\| participant\.date_of_birth/);
  assert.match(route, /member\.date_of_birth && corresponding\.date_of_birth !== member\.date_of_birth/);
  assert.match(route, /isUnder18On/);
  assert.match(route, /pendingGuardianConsentGap/);
});

test("existing staff and guardian activation protections remain intact", () => {
  assert.match(route, /requireSystemPermission\(request, "members\.renew"\)|kind === "renewal" \? "members\.renew"/);
  assert.match(route, /Renewal cannot use same existing member|A renewal cannot use the same existing member twice/);
  assert.match(route, /existing member date of birth|permanent member record/);
  assert.match(route, /guardian_present_verified_at/);
});
