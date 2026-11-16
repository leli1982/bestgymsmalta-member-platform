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
