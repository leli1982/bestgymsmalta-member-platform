import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routeUrl = new URL(
  "../app/api/system/members/enroll/route.ts",
  import.meta.url
);

function source() {
  return fs.readFileSync(routeUrl, "utf8");
}

test("new and renewal applications use distinct granular permissions", () => {
  const route = source();
  assert.match(route, /members\.create/);
  assert.match(route, /members\.renew/);
  assert.match(route, /requireSystemPermission/);
});

test("Application Staff Name is mandatory server-side for both membership paths", () => {
  const route = source();
  assert.match(route, /requireStaffName\([^)]*staffName/i);
  assert.match(route, /staff_name/);
  assert.match(route, /membership\.application\.submit/);
});

test("payment activation requires a separate Activation Staff Name and activation permission", () => {
  const route = source();
  assert.match(route, /membership\.activate/);
  assert.match(route, /activationStaffName/);
  assert.match(route, /Activation Staff Name/);
  assert.match(route, /bgm_activate_membership_application/);
});

test("renewal validates existing member identities while new applications never generate member numbers in the route", () => {
  const route = source();
  assert.match(route, /existingMemberId/);
  assert.match(route, /buildEnrollmentIdentityAction/);
  assert.doesNotMatch(route, /member_number\s*:/i);
  assert.doesNotMatch(route, /formatMembershipNumber/);
});

test("application creation stores explicit membership dates and never activates as a side effect", () => {
  const route = source();
  assert.match(route, /start_date/);
  assert.match(route, /expiry_date/);
  assert.match(route, /awaiting_payment/);
  assert.doesNotMatch(route, /status:\s*["']activated["'][\s\S]{0,300}bgm_membership_applications/i);
});
