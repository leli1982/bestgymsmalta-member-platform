import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const forgot = fs.readFileSync(
  new URL("../app/api/member/auth/forgot-password/route.ts", import.meta.url),
  "utf8"
);
const loginUi = fs.readFileSync(
  new URL("../components/member-auth/MemberLoginPage.tsx", import.meta.url),
  "utf8"
);
const adminMembers = fs.readFileSync(
  new URL("../app/api/admin/members/route.ts", import.meta.url),
  "utf8"
);

test("password reset scopes duplicate email by member number", () => {
  assert.match(forgot, /memberNumber/);
  assert.match(forgot, /normalizeMembershipNumber/);
  assert.match(forgot, /\.eq\(["']member_number["']/);
  assert.match(forgot, /\.eq\(["']email["']/);
});

test("forgot password UI submits membership number with email", () => {
  assert.match(loginUi, /forgotMemberNumber/);
  assert.match(loginUi, /Membership Number/);
  assert.match(loginUi, /BGM0000001/);
  assert.match(loginUi, /memberNumber:\s*forgotMemberNumber\.trim\(\)/);
});

test("new member creation can use database-generated membership number", () => {
  assert.doesNotMatch(adminMembers, /Member number is required/);
  assert.match(adminMembers, /parseMembershipNumber/);
  assert.match(adminMembers, /member_number/);
});
