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

test("payroll dates use the shared DD/MM/YYYY auto-format input", () => {
  const employees = read("components/staff/StaffEmployeesAdmin.tsx");
  const detail = read("components/staff/StaffEmployeeDetail.tsx");
  const holidays = read("components/staff/StaffPublicHolidaysAdmin.tsx");
  assert.match(employees, /EuropeanDateInput/);
  assert.match(detail, /EuropeanDateInput/);
  assert.match(holidays, /EuropeanDateInput/);
});

test("staff photo offers real webcam capture and separate upload", () => {
  const detail = read("components/staff/StaffEmployeeDetail.tsx");
  const camera = read("components/staff/StaffCameraCaptureBridge.tsx");
  const page = read("app/staff/admin/staff/page.tsx");
  assert.match(detail, /Take Photo/);
  assert.match(detail, /Upload Photo/);
  assert.match(detail, /normaliseStaffPhoto/);
  assert.match(camera, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(camera, /<video/);
  assert.match(camera, /Capture Photo/);
  assert.match(page, /StaffCameraCaptureBridge/);
});

test("attendance and payroll inputs force a legible light field treatment", () => {
  const page = read("app/staff/admin/staff/page.tsx");
  const css = read("app/staff/admin/staff/staff-payroll.css");
  assert.match(page, /staff-payroll\.css/);
  assert.match(css, /background-color: #ffffff !important/);
  assert.match(css, /color: #09090b !important/);
});

test("staff records can be deactivated and only history-free records can be deleted", () => {
  const detail = read("components/staff/StaffEmployeeDetail.tsx");
  const route = read("app/api/system/staff-employees/[employeeId]/route.ts");
  assert.match(detail, /Deactivate staff/);
  assert.match(detail, /Reactivate staff/);
  assert.match(detail, /Delete Staff/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /cannot be deleted\. Deactivate the employee instead/);
});
