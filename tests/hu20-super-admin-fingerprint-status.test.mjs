import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(path, "utf8");

test("Super Admin can request the exact active TEST fingerprint status for one employee", () => {
  const api = read("app/api/system/staff-hu20/biometrics/route.ts");
  assert.match(api, /if \(!isHu20TestRequestEnabled\(\)\) return fail\("Unavailable\.", 404\)/);
  assert.match(api, /requireSuperAdmin\(request\)/);
  assert.match(api, /searchParams\.get\("employeeId"\)/);
  assert.match(api, /employeeId !== null && !validHu20TerminalId\(employeeId\)/);
  assert.match(api, /query\.eq\("employee_id", employeeId\)/);
  assert.match(api, /\.eq\("active", true\)\.eq\("status", "enrolled"\)/);
  assert.doesNotMatch(api, /select\([^\n]*(?:encrypted_template|template_data|terminal_secret)/);
});

test("Super Admin staff profile checks enrolled state before offering local capture", () => {
  const ui = read("components/staff/Hu20QuickEnrollment.tsx");
  const statusIndex = ui.indexOf('"/api/system/staff-hu20/biometrics?employeeId="');
  const deviceIndex = ui.indexOf("const local = await readLocalDevice();");
  assert.ok(statusIndex >= 0 && deviceIndex > statusIndex,
    "Verify an existing enrolled finger before probing the local PC");
  assert.match(ui, /item\.employee_id === employeeId && item\.active === true && item\.status === "enrolled"/);
  assert.match(ui, /setState\("enrolled"\)/);
  assert.match(ui, /state === "enrolled" \? "Fingerprint already enrolled in TEST"/);
  assert.match(ui, /disabled=\{state !== "ready" \|\| !active\}/);
  assert.match(ui, /audited revocation controls before replacing a fingerprint/);
  assert.match(ui, /Cannot verify this employee's TEST fingerprint status/);
  assert.doesNotMatch(ui, /terminalSecret|vercelBypass|_vercel_share|localStorage|sessionStorage/);
});
