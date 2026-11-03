import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  new URL("../app/api/member/auth/legacy-register/route.ts", import.meta.url),
  "utf8"
);

test("legacy activation looks up existing members by legacy PK only", () => {
  assert.match(route, /\.eq\(["']legacy_pk_customer["'],\s*legacyPk\)/);
  assert.doesNotMatch(route, /\.insert\(/);
});

test("legacy activation preserves current member protections", () => {
  assert.match(route, /member\.status\s*!==\s*["']active["']/);
  assert.match(route, /member\.app_enrolled/);
  assert.match(route, /This username is already taken/);
  assert.match(route, /bcrypt\.hash\(password,\s*10\)/);
});

test("no-email recovery saves the new email atomically with activation", () => {
  assert.match(route, /if\s*\(resolution\.shouldUpdateEmail\)/);
  assert.match(route, /updatePayload\.email\s*=\s*email/);
  assert.match(route, /app_enrolled:\s*true/);
  assert.match(route, /\.update\(updatePayload\)/);
  assert.equal((route.match(/\.update\(/g) || []).length, 1,
    "email and activation should be written in one member update");
});

test("legacy activation never returns BGM number before successful update", () => {
  const updateIndex = route.indexOf("const updateResult");
  const revealIndex = route.indexOf("recoveredMemberNumber");
  assert.ok(updateIndex >= 0 && revealIndex > updateIndex);
  assert.match(route, /setMemberSessionCookie/);
});

test("missing-email records request DOB and mobile verification", () => {
  assert.match(route, /needsIdentityCheck:\s*true/);
  assert.match(route, /dateOfBirth/);
  assert.match(route, /mobile/);
});
