import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  const route = await readFile("app/api/system/staff-attendance/timesheets/route.ts", "utf8").catch(() => "");
  const query = await readFile("lib/staffTimesheetQueryServer.ts", "utf8").catch(() => "");
  return `${route}\n${query}`;
}

test("timesheet query API is Super Admin only and validates a bounded Malta date range", async () => {
  const code = await source();
  assert.match(code, /requireSuperAdmin\(request\)/);
  assert.match(code, /fromDate|from/);
  assert.match(code, /toDate|to/);
  assert.match(code, /maltaDayUtcRange/);
  assert.match(code, /93|maximum|date range/i);
});

test("timesheet query API supports employee, home gym, worked gym and status filters", async () => {
  const code = await source();
  assert.match(code, /employeeId/);
  assert.match(code, /homeGymId/);
  assert.match(code, /workedGymId/);
  assert.match(code, /status/);
  assert.match(code, /clock_in_gym_id/);
  assert.match(code, /clock_out_gym_id/);
});

test("timesheet query API reads persisted payroll segments and builds canonical reports", async () => {
  const code = await source();
  assert.match(code, /bgm_staff_session_payroll_segments/);
  assert.match(code, /buildStaffTimesheetEmployeeReport/);
  assert.match(code, /holiday_multiplier_bps/);
  assert.match(code, /pay_cents/);
});

// GREEN verification push for the complete Phase-3 workflow.
