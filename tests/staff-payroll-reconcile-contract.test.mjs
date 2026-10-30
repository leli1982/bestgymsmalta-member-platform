import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Super Admin exposes Staff payroll management while Staff Punch Clock stays disabled", () => {
  const admin = read("components/staff/SuperAdminHome.tsx");
  const staff = read("components/staff/StaffDashboard.tsx");
  const payroll = read("components/staff/StaffEmployeesAdmin.tsx");

  assert.match(admin, /href: "\/staff\/admin\/staff"/);
  assert.match(admin, /Manage staff employment, pay configuration, attendance and payroll/);
  assert.match(staff, /<Tile label="Punch Clock" icon=\{Clock3\} disabled \/>/);
  assert.doesNotMatch(payroll, /StaffTerminalsAdmin/);
  assert.doesNotMatch(payroll, /Punch Clock Terminals/);
});

test("reconciled payroll admin keeps reader-specific staff UI out of this phase", () => {
  const payroll = read("components/staff/StaffEmployeesAdmin.tsx");
  assert.doesNotMatch(payroll, /fingerprintStatus/);
  assert.doesNotMatch(payroll, /filters\.fingerprint/);
  assert.match(payroll, /Employees/);
  assert.match(payroll, /Timesheets/);
  assert.match(payroll, /Public Holidays/);
});
