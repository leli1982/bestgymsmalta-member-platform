import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const get = (p) => fs.readFileSync(p, "utf8");
const api=get("app/api/staff-hu20/kiosk/preflight/route.ts");
const registry=get("app/api/system/staff-hu20/terminals/route.ts");
const screen=get("native/Bgm.SecuGenHu20Probe/Hu20-KioskDisplay.ps1");
const scanner=get("native/Bgm.SecuGenHu20Probe/Hu20-AutoKiosk.ps1");
const ui=get("app/staff/admin/staff/terminals/page.tsx");

test("startup preflight is TEST-locked, authenticated, and quota-free",()=>{
  for (const s of ["isHu20TestRequestEnabled","BGM_HU20_KIOSK_TEST_ENABLED","BGM_HU20_ATTENDANCE_TEST_ENABLED","authenticateHu20Terminal(request)","bgm_hu20_test_kiosk_windows",'eq("terminal_id", terminal.id)','eq("status", "active")','gt("expires_at"','gym.data.status !== "active"',"recognitionAuthorisationConsumed: false","attendanceRecorded: false","scansRemaining:"]) assert.ok(api.includes(s),s);
  assert.doesNotMatch(api,/claim_recognition|finish_recognition|record_attendance|encrypted_template|MatchTemplate|attendance_punch_event_id|\.insert\(|\.update\(/);
});

test("native scanner requires server-verified gym and window before claiming recognition",()=>{
  const preflight=scanner.indexOf('Invoke-WebRequest -Uri "$base/api/staff-hu20/kiosk/preflight"');
  const claim=scanner.indexOf('Invoke-WebRequest -Uri "$base/api/staff-hu20/recognition/begin"');
  assert.ok(preflight>=0 && claim>preflight);
  for (const s of ["OrdinalIgnoreCase","preflight.terminal.gymId","preflight.window.scansRemaining -lt 1","preflight.window.expiresAt","Set-Hu20KioskLocation -GymName $registeredGym"]) assert.ok(scanner.includes(s),s);
  assert.match(screen,/function Set-Hu20KioskLocation/);
  assert.match(screen,/FICTIONAL TEST ONLY/);
  assert.match(screen,/Assert-Hu20KioskDisplay/);
});

test("deactivation requires TEST Super Admin, disables credentials, cancels windows and audits",()=>{
  const p=registry.slice(registry.indexOf("export async function PATCH"));
  assert.ok(p.length>0);
  for (const s of ["isHu20TestRequestEnabled","requireSuperAdmin", 'request.headers.get("origin")','body.action !== "deactivate"','.update({ active: false })',"bgm_hu20_test_kiosk_windows",'eq("terminal_id", disabled.data.id)',"staff.hu20.terminal.deactivated.test","writeStaffAudit"]) assert.ok(p.includes(s),s);
  assert.ok(p.indexOf('.update({ active: false })')<p.indexOf("bgm_hu20_test_kiosk_windows"));
  assert.doesNotMatch(p,/update\(\{ active: true \}\)|credential_hash\s*:/);
  assert.match(ui,/Deactivate TEST terminal/);
  assert.match(ui,/replacement requires a NEW terminal registration/);
  assert.match(ui,/method: "PATCH"/);
});
