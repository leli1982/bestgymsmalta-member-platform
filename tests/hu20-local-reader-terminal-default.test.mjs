import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/staff/admin/staff/terminals/enrollment/page.tsx", "utf8");
test("local reader hint preselects only a registered ACTIVE terminal from the installed Windows opener", () => {
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\("localTerminalId"\)/);
  assert.match(page, /data\.terminals\.find\(item => item\.active && item\.id === suggestedId\)/);
  assert.match(page, /setTerminalId\(matched\.id\)/);
  assert.match(page, /not terminal authentication/);
  assert.match(page, /select a registered terminal manually/);
  assert.doesNotMatch(page, /last_seen_at|sessionStorage\.getItem\("terminal/);
});
test("enrolment request still selects the actual registered terminal through Super Admin POST", () => {
  assert.match(page, /body: JSON\.stringify\(\{ employeeId, terminalId \}\)/);
  assert.match(page, /disabled=\{busy \|\| !employeeId \|\| !terminalId/);
  assert.match(page, /For fictional HU20-TEST staff only/);
});

test("Super Admin login returns to the exact authenticated TEST enrollment deep link", () => {
  const login = fs.readFileSync("components/staff/StaffLoginPage.tsx", "utf8");
  assert.match(login, /function safeHu20EnrollmentReturnPath\(\)/);
  assert.match(login, /new URLSearchParams\(window\.location\.search\)\.get\("returnTo"\)/);
  assert.match(login, /target\.origin !== window\.location\.origin/);
  assert.match(login, /target\.pathname !== "\/staff\/admin\/staff\/terminals\/enrollment"/);
  assert.match(login, /target\.hash/);
  assert.match(login, /getAll\(key\)\.length !== 1/);
  assert.match(login, /window\.location\.replace\(returnPath\)/);
  assert.match(login, /sessionUser\?\.isSuperAdmin/);
  assert.match(login, /data\.user\?\.isSuperAdmin/);
  assert.match(page, /response\.status === 401/);
  assert.match(page, /setSuperAdminLoginHref\("\/staff\?returnTo=" \+ encodeURIComponent\(returnPath\)\)/);
  assert.match(page, /Sign in as Super Admin and return to this HU20 enrolment/);
  assert.doesNotMatch(login, /sessionStorage\.setItem\("terminal|localStorage\.setItem\("terminal/);
});
