import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const enrollment=fs.readFileSync("app/staff/admin/staff/terminals/enrollment/page.tsx","utf8");
const staff=fs.readFileSync("components/staff/StaffEmployeeDetail.tsx","utf8");
const terminal=fs.readFileSync("app/staff/admin/staff/terminals/page.tsx","utf8");
test("TEST employee detail directly links to supervised enrollment, never for real staff",()=>{
  assert.match(staff,/e\.idNumber\.startsWith\("HU20-TEST-"\)/);
  assert.match(staff,/employeeId=\$\{encodeURIComponent\(e\.id\)\}/);
  assert.match(enrollment,/new URLSearchParams\(window\.location\.search\)/);
  assert.match(enrollment,/data\.employees\.some\(\(employee\) => employee\.id === id && employee\.active\)/);
  assert.match(enrollment,/chosenAlreadyEnrolled/);
  assert.match(enrollment,/pendingForChosen/);
  assert.match(terminal,/Enable or disable Punch Clock per TEST gym/);
});

test("Super Admin Staff profile embeds single-click TEST reader workflow after staff creation", () => {
  const quick = fs.readFileSync("components/staff/Hu20QuickEnrollment.tsx", "utf8");
  const staffManagement = fs.readFileSync("components/staff/StaffEmployeesAdmin.tsx", "utf8");
  assert.match(staff, /<Hu20QuickEnrollment employeeId=\{e\.id\}/);
  assert.match(quick, /127\.0\.0\.1:8765/);
  assert.match(quick, /readLocalDevice/);
  assert.match(quick, /fetch\("\/api\/system\/staff-hu20\/enrollments"/);
  assert.match(quick, /method: "POST"/);
  assert.match(quick, /employeeId, terminalId: device\.terminalId/);
  assert.match(quick, /nonce: device\.nonce/);
  assert.match(quick, /item\.status === "completed"/);
  assert.match(staffManagement, /setSelectedId\(body\.employee\.id\)/);
  assert.doesNotMatch(quick, /localStorage|sessionStorage|terminalSecret|vercelBypass|_vercel_share/);
});
