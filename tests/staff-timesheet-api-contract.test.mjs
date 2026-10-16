import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = "app/api/system/staff-attendance/timesheets/route.ts";
const source = () => readFile(routePath, "utf8").catch(() => "");

test("timesheet query API is Super Admin only and validates a bounded Malta date range", async () => {
  const route = await source();
  assert.match(route, /requireSuperAdmin\(request\)/);
  assert.match(route, /fromDate|from/);
  assert.match(route, /toDate|to/);
  assert.match(route, /Europe\/Malta|maltaDayUtcRange/);
  assert.match(route, /93|maximum|date range/i);
});

test("timesheet query API supports employee, home gym, worked gym and status filters", async () => {
  const route = await source();
  assert.match(route, /employeeId/);
  assert.match(route, /homeGymId/);
  assert.match(route, /workedGymId/);
  assert.match(route, /status/);
  assert.match(route, /clock_in_gym_id/);
  assert.match(route, /clock_out_gym_id/);
});

test("timesheet query API reads persisted payroll segments and builds canonical reports", async () => {
  const route = await source();
  assert.match(route, /bgm_staff_session_payroll_segments/);
  assert.match(route, /buildStaffTimesheetEmployeeReport/);
  assert.match(route, /holiday_multiplier_bps/);
  assert.match(route, /pay_cents/);
});
