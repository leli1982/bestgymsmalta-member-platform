import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(path, "utf8");
}

test("Super Admin home exposes Staff without replacing Staff Portal logins", async () => {
  const home = await source("components/staff/SuperAdminHome.tsx");
  assert.match(home, /href:\s*["']\/staff\/admin\/staff["']/);
  assert.match(home, /label:\s*["']Staff["']/);
  assert.match(home, /Staff Portal logins/);
  assert.doesNotMatch(home, /Punch Clock will be added in a later phase/);
});

test("staff employment shell exposes the required management areas", async () => {
  const page = await source("app/staff/admin/staff/page.tsx");
  const shell = await source("components/staff/StaffEmployeesAdmin.tsx");
  assert.match(page, /StaffEmployeesAdmin/);
  for (const label of ["Employees", "Timesheets", "Public Holidays", "Punch Clock Terminals"]) {
    assert.match(shell, new RegExp(label));
  }
  for (const filter of ["Search", "Home gym", "Active", "Employment type", "Fingerprint"]) {
    assert.match(shell, new RegExp(filter, "i"));
  }
});

test("employee UI captures profile, pay configuration and effective dates", async () => {
  const detail = await source("components/staff/StaffEmployeeDetail.tsx");
  for (const label of [
    "First name", "Surname", "ID card", "Address", "Mobile", "Email", "Home gym",
    "Photo", "Active", "Full Time", "Part Time", "Hourly rate", "Effective from",
    "Details", "Attendance", "Payroll", "Audit"
  ]) {
    assert.match(detail, new RegExp(label, "i"));
  }
  assert.match(detail, /\/rate/);
  assert.match(detail, /\/employment-type/);
  assert.match(detail, /\/photo/);
});

test("public holiday UI has separate Full Time and Part Time multipliers and version history", async () => {
  const holidays = await source("components/staff/StaffPublicHolidaysAdmin.tsx");
  for (const label of ["Name", "Date", "Full Time multiplier", "Part Time multiplier", "Active", "Note", "Version history"]) {
    assert.match(holidays, new RegExp(label, "i"));
  }
  assert.match(holidays, /10000/);
  assert.match(holidays, /\/api\/system\/staff-public-holidays/);
});
