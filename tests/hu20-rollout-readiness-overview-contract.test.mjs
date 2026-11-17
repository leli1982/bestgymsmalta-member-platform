import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const load = (path) => fs.readFileSync(path, "utf8");
const terminalsApi = load("app/api/system/staff-hu20/terminals/route.ts");
const page = load("app/staff/admin/staff/terminals/page.tsx");
const overview = load("components/staff/Hu20RolloutReadinessPanel.tsx");

test("Super Admin TEST inventory exposes gym rollout flags but not credentials", () => {
  assert.match(terminalsApi, /requireSuperAdmin\(request\)/);
  assert.match(terminalsApi, /isHu20TestRequestEnabled\(\)/);
  assert.match(terminalsApi, /select\("id, name, status, hu20_punch_clock_enabled"\)/);
  assert.doesNotMatch(terminalsApi, /credential_hash|encrypted_template/);
});
test("read-only overview never suggests recent authentication means reader online", () => {
  assert.match(page, /Hu20RolloutReadinessPanel/);
  assert.match(page, /checkedAt=\{terminalCheckedAt\}/);
  assert.match(overview, /Recent authentication does not prove a PC or its fingerprint reader is online/);
  assert.match(overview, /hu20TerminalContactStatus/);
  assert.match(overview, /registered Windows PC/);
  assert.match(overview, /Only fictional TEST employees/);
  assert.doesNotMatch(overview, /fetch\(|onClick|PATCH|POST/);
});
