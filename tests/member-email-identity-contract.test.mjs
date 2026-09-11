import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const forgot = fs.readFileSync(
  new URL("../app/api/member/auth/forgot-password/route.ts", import.meta.url),
  "utf8"
);
const loginRoute = fs.readFileSync(
  new URL("../app/api/member/auth/login/route.ts", import.meta.url),
  "utf8"
);
const registerRoute = fs.readFileSync(
  new URL("../app/api/member/auth/register/route.ts", import.meta.url),
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

test("member login never uses email as a standalone identity", () => {
  assert.doesNotMatch(loginRoute, /email\.eq\./);
  assert.doesNotMatch(loginRoute, /\.or\(/);
  assert.match(loginRoute, /\.eq\(["']member_number["']/);
  assert.match(loginRoute, /\.eq\(["']username["']/);
});

test("activated members can log in with an exact non-BGM card/member identifier", () => {
  assert.doesNotMatch(loginRoute, /parseMembershipNumber/);
  assert.match(loginRoute, /rawLogin/);
  assert.match(loginRoute, /\.eq\(["']username["'],\s*login\)/);
  assert.match(loginRoute, /\.eq\(["']member_number["'],\s*rawLogin\)/);
});

test("member login UI clearly supports username or permanent membership number", () => {
  assert.match(loginUi, /Username or Membership Number/);
  assert.match(loginUi, /BGM0000001/);
});

test("blank-email members are safely directed to reception before activation", () => {
  assert.doesNotMatch(
    registerRoute,
    /!memberNumber\s*\|\|\s*!email\s*\|\|\s*!username\s*\|\|\s*!password/
  );
  assert.match(registerRoute, /registeredEmail/);
  assert.match(registerRoute, /if\s*\(!registeredEmail\)/);
  assert.match(registerRoute, /No email is registered for this membership/i);
});

test("activation UI lets blank-email members reach the safe server path", () => {
  assert.doesNotMatch(
    loginUi,
    /!memberNumber\.trim\(\)\s*\|\|\s*!email\.trim\(\)\s*\|\|\s*!username\.trim\(\)/
  );
  assert.match(loginUi, /Registered Email \(if available\)/);
});

test("activation still verifies the registered email when one exists", () => {
  assert.match(registerRoute, /email\s*!==\s*registeredEmail/);
});

test("new member creation can use database-generated membership number", () => {
  assert.doesNotMatch(adminMembers, /Member number is required/);
  assert.match(adminMembers, /parseMembershipNumber/);
  assert.match(adminMembers, /member_number/);
});
