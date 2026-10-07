import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("staff-facing member views use Original Gym wording without renaming legacy data contracts", () => {
  for (const path of [
    "components/staff/StaffHomeScanner.tsx",
    "components/staff/StaffGlobalScanner.tsx",
    "components/staff/StaffMemberBrowser.tsx",
    "components/staff/ActiveMembersByGymAdmin.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, />Legacy [Gg]ym:/);
    assert.doesNotMatch(source, /Legacy Gym:/);
    assert.match(source, /Original [Gg]ym/);
  }

  const scanner = read("components/staff/StaffHomeScanner.tsx");
  assert.match(scanner, /result\.member\.legacyGym/);
});

test("sundries uses explicit minus and plus quantity controls for standard and custom items", () => {
  const source = read("components/staff/SundriesCatalogForm.tsx");
  assert.match(source, /\bMinus\b/);
  assert.match(source, /\bPlus\b/);
  assert.match(source, /aria-label=\{`Decrease \$\{name\}`\}/);
  assert.match(source, /aria-label=\{`Increase \$\{name\}`\}/);
  assert.match(source, /disabled=\{quantity === 0\}/);
  assert.match(source, /<SundriesQuantityPicker/);
});

test("shared registration form uses canonical Malta locality options for staff and tablet enrollment", () => {
  const source = read("components/membership/RegistrationForm.tsx");
  const localities = read("lib/maltaLocalities.ts");

  assert.match(source, /MALTA_LOCALITIES/);
  assert.match(source, /<select[^>]*value=\{participant\.town\}/s);
  assert.doesNotMatch(source, /Town \/ locality<input/);
  assert.match(localities, /export const MALTA_LOCALITIES/);
  assert.match(localities, /"Valletta"/);
  assert.match(localities, /"Victoria"/);
  assert.match(localities, /"St Julian's"/);

  const staffPage = read("components/staff/MembershipEnrollmentPage.tsx");
  const tabletPage = read("components/membership/JoinEnrollmentPage.tsx");
  assert.match(staffPage, /RegistrationForm/);
  assert.match(tabletPage, /mode="tablet"/);
});
