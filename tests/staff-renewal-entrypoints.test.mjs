import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

const dashboard = read("components/staff/StaffDashboard.tsx");
const browser = read("components/staff/StaffMemberBrowser.tsx");
const enrollment = read("components/staff/MembershipEnrollmentPage.tsx");
const renewal = read("components/staff/StaffRenewalEnrollmentPage.tsx");
const searchRoute = read("app/api/system/members/search/route.ts");

test("New Member tile opens a chooser for new membership or renewal", () => {
  assert.match(dashboard, /membershipAction|membershipChooser|membershipMenu/i);
  assert.match(dashboard, /NEW MEMBER/);
  assert.match(dashboard, /RENEW/);
  assert.match(dashboard, /\/staff\/members\/enroll\?kind=new/);
  assert.match(dashboard, /\/staff\/members\/enroll\?kind=renewal/);
});

test("member detail exposes direct renew membership action", () => {
  assert.match(browser, /RENEW MEMBERSHIP/);
  assert.match(browser, /kind=renewal/);
  assert.match(browser, /memberNumber/);
});

test("renewal deep link remains routed to the preserved renewal implementation", () => {
  assert.match(enrollment, /useSearchParams/);
  assert.match(enrollment, /searchParams\.get\(["']kind["']\)/);
  assert.match(enrollment, /searchParams\.get\(["']memberNumber["']\)/);
  assert.match(enrollment, /StaffRenewalEnrollmentPage/);
  assert.match(renewal, /selectRenewalMember/);
  assert.match(renewal, /searchParams\.get\(["']memberNumber["']\)/);
});

test("renewal member selection carries the full stored member profile", () => {
  for (const field of [
    "addressLine1",
    "addressLine2",
    "postcode",
    "idNumber",
    "dateOfBirth",
    "phone",
    "email",
    "nextOfKin",
    "officialPhotoPath",
  ]) {
    assert.match(renewal, new RegExp(field));
  }

  for (const dbField of [
    "address_line_1",
    "address_line_2",
    "postcode",
    "id_number",
    "date_of_birth",
    "next_of_kin",
  ]) {
    assert.match(searchRoute, new RegExp(dbField));
  }
});

test("renewal card flow keeps existing card or stages replacement until activation", () => {
  const assignRoute = read("app/api/system/members/card/assign/route.ts");
  assert.match(assignRoute, /decideRenewalCardAction/);
  assert.match(assignRoute, /renewalCardAction\s*=\s*["']keep["']/);
  assert.match(assignRoute, /renewalCardAction\s*=\s*["']replace["']/);
  assert.match(assignRoute, /status:\s*["']reserved["']/);
});
