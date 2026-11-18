import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const route = fs.readFileSync("app/api/system/staff-hu20/kiosk/route.ts","utf8");
const begin = fs.readFileSync("app/api/staff-hu20/recognition/begin/route.ts","utf8");
const sql = fs.readFileSync("supabase/migrations/20261113_160000_hu20_test_bounded_kiosk_windows.sql","utf8");
const ui = fs.readFileSync("components/staff/Hu20TestKioskWindowsPanel.tsx","utf8");

test("auto kiosk is TEST-only, Super Admin gated, bounded and audited",()=>{
  for(const key of ["BGM_HU20_KIOSK_TEST_ENABLED","BGM_HU20_RECOGNITION_TEST_ENABLED","BGM_HU20_ATTENDANCE_TEST_ENABLED","requireSuperAdmin","validOrigin","maxScans = 6","10 * 60 * 1000","staff.hu20.kiosk.started.test","staff.hu20.kiosk.stopped.test"]) assert.ok(route.includes(key),key);
  assert.match(route,/export async function GET/);
  assert.match(route,/export async function POST/);
  assert.match(route,/export async function PATCH/);
  assert.doesNotMatch(route,/encrypted_template|terminalSecret|credential_hash/);
  assert.match(ui,/Stop TEST kiosk now/);
  assert.match(ui,/Start 10-minute TEST kiosk/);
});
test("each kiosk claim is single use, limited, serialized, and rejected on revoked window",()=>{
  for(const part of ["SECURITY INVOKER","FOR UPDATE","FOR SHARE","60 seconds","70 seconds","kiosk_window_id","scans_used=scans_used+1","status='claimed'","status='completed'","attendance_consumed_at","bgm_hu20_test_kiosk_guard","REVOKE ALL","service_role"]) assert.ok(sql.includes(part),part);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(begin,/x-bgm-hu20-kiosk-test/);
  assert.match(begin,/bgm_hu20_test_claim_kiosk_recognition/);
  assert.match(begin,/kioskTestOnly: kioskMode/);
  assert.match(begin,/TEST kiosk cooldown/);
});
