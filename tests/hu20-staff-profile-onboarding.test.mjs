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
