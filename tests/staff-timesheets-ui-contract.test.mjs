import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(path, "utf8").catch(() => ""); }

test("Super Admin staff area exposes the live Timesheets workflow", async () => {
  const staff = await source("components/staff/StaffEmployeesAdmin.tsx");
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(staff, /StaffTimesheetsAdmin/);
  assert.match(component, /Timesheets/);
  assert.match(component, /This week/);
  assert.match(component, /This month/);
  assert.match(component, /Custom/);
  assert.match(component, /Home gym/);
  assert.match(component, /Worked gym/);
  assert.match(component, /Needs Attention/i);
});

test("timesheet UI shows individual IN OUT rows and all required totals", async () => {
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(component, /IN/);
  assert.match(component, /OUT/);
  assert.match(component, /Daily total/);
  assert.match(component, /Weekly/);
  assert.match(component, /Monthly/);
  assert.match(component, /Selected Period/);
  assert.match(component, /Normal pay/);
  assert.match(component, /Public holiday pay/);
  assert.match(component, /Total calculated pay/);
});

test("employee detail Attendance and Payroll panels consume the canonical timesheet component", async () => {
  const detail = await source("components/staff/StaffEmployeeDetail.tsx");
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(detail, /StaffTimesheetsAdmin/);
  assert.match(component, /staff-attendance\/timesheets/);
  assert.doesNotMatch(detail, /reserved for the next attendance\/payroll implementation stage/i);
});

test("timesheet UI exposes manual punch and session correction actions with mandatory reasons", async () => {
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(component, /Manual Punch/);
  assert.match(component, /Correct Session/);
  assert.match(component, /reason/i);
  assert.match(component, /manual-punch/);
  assert.match(component, /sessions\//);
});
