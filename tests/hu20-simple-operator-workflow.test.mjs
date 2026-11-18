import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = name => fs.readFileSync(name, "utf8");

test("Save staff opens profile where the fingerprint step follows, without a terminal selector", () => {
  const form = read("components/staff/StaffEmployeesAdmin.tsx");
  const profile = read("components/staff/StaffEmployeeDetail.tsx");
  const quick = read("components/staff/Hu20QuickEnrollment.tsx");
  assert.match(form, /Step 1 — Add staff details/);
  assert.match(form, /Save staff &amp; continue to fingerprint/);
  assert.match(form, /setSelectedId\(body\.employee\.id\)/);
  assert.match(profile, /Hu20PilotStaffActivation/);
  assert.match(quick, /Enrol Fingerprint/);
  assert.match(quick, /readLocalDevice/);
  assert.match(quick, /t\.active && t\.id === local\.terminalId/);
  assert.match(quick, /device\.terminalId !== terminalId/);
  assert.doesNotMatch(quick, /terminalSecret|vercelBypass|_vercel_share|localStorage|sessionStorage/);
});

test("One click retains individually approved, audited TEST-only real staff enrollment", () => {
  const pilot = read("components/staff/Hu20PilotStaffActivation.tsx");
  const quick = read("components/staff/Hu20QuickEnrollment.tsx");
  const api = read("app/api/system/staff-hu20/enrollments/route.ts");
  assert.match(pilot, /Step 2 — Enrol Fingerprint/);
  assert.match(pilot, /A Super Admin must activate each real employee separately/);
  assert.match(pilot, /window\.confirm/);
  assert.match(pilot, /onAuthorize=\{authoriseBeforeCapture\}/);
  assert.match(pilot, /method:"POST"/);
  assert.match(pilot, /enabled:true/);
  assert.match(pilot, /Disable and revoke fingerprint pilot/);
  assert.match(quick, /if \(mode === "real-pilot" && onAuthorize\) await onAuthorize\(\)/);
  const indexApproval = quick.indexOf("await onAuthorize()");
  const indexRequest = quick.indexOf('fetch("/api/system/staff-hu20/enrollments", {\n        method: "POST"');
  const indexNative = quick.indexOf('fetch(BRIDGE + "/enroll"');
  assert.ok(indexApproval !== -1 && indexApproval < indexRequest && indexRequest < indexNative,
    "Per-employee approval precedes the independently guarded enrollment API and native capture");
  assert.match(api, /Super Admin pilot authorisation required/);
  assert.match(api, /hu20_punch_clock_enabled !== true/);
});

test("Operator punch clock screen never pretends to capture fingerprints in the browser", () => {
  const screen = read("app/staff/punch-clock/page.tsx");
  const native = read("native/Bgm.SecuGenHu20Probe/Hu20-KioskDisplay.ps1");
  assert.match(screen, /Staff Punch Clock/);
  assert.match(screen, /ISOLATED TEST PILOT/);
  assert.match(screen, /PLACE FINGER/);
  assert.match(screen, /CLOCKED IN/);
  assert.match(screen, /CLOCKED OUT/);
  assert.match(screen, /browser screen does not scan fingerprints or record punches/);
  assert.match(screen, /punchClockEnabled===true/);
  assert.doesNotMatch(screen, /\/(api\/staff-hu20\/attendance|api\/staff-hu20\/enrollments\/complete)/);
  assert.match(native, /STAFF PUNCH CLOCK/);
  assert.match(native, /clock_in/);
  assert.match(native, /clock_out/);
  assert.match(native, /NOT RECOGNISED/);
  assert.match(native, /STAFF PILOT TEST/);
  assert.match(native, /NOT PRODUCTION/);
  assert.doesNotMatch(native, /Invoke-RestMethod|HttpListener|GetImage|MatchTemplate/);
});
