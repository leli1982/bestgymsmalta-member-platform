import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const loginPage = fs.readFileSync(
  new URL("../app/member-login/page.tsx", import.meta.url),
  "utf8"
);
const legacyUi = fs.readFileSync(
  new URL("../components/member-auth/LegacyMemberActivationPage.tsx", import.meta.url),
  "utf8"
);

test("member login offers a clear legacy activation option", () => {
  assert.match(loginPage, /\/legacy-activate/);
  assert.match(loginPage, /I only know my old membership number/i);
});

test("legacy activation submits old PK and email to dedicated API", () => {
  assert.match(legacyUi, /Old Membership \/ PK Number/);
  assert.match(legacyUi, /\/api\/member\/auth\/legacy-register/);
  assert.match(legacyUi, /legacyPk:\s*legacyPk\.trim\(\)/);
  assert.match(legacyUi, /email:\s*email\.trim\(\)/);
});

test("legacy activation reveals DOB and mobile only for extra verification", () => {
  assert.match(legacyUi, /needsIdentityCheck/);
  assert.match(legacyUi, /Legacy member date of birth/);
  assert.match(legacyUi, /Legacy member mobile number/);
  assert.match(legacyUi, /save the email above to your membership record/i);
});

test("successful recovery shows the assigned BGM number before continuing", () => {
  assert.match(legacyUi, /recoveredMemberNumber/);
  assert.match(legacyUi, /Your permanent BestGymsMalta member number is/);
  assert.match(legacyUi, /Continue to Member App/);
  assert.match(legacyUi, /saveMember\(activatedMember\)/);
});

test("successful no-email recovery tells the member their email was saved", () => {
  assert.match(legacyUi, /emailUpdated/);
  assert.match(legacyUi, /new email address has also been saved/i);
});
