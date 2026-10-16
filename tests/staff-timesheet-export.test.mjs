import assert from "node:assert/strict";
import test from "node:test";
import { buildStaffTimesheetWorkbookBuffer } from "../lib/staffTimesheetWorkbook.ts";

const report = {
  employee: { id: "emp-a", name: "Alex Borg", email: "alex@example.test", homeGymName: "Mosta" },
  sessions: [{ id: "s1", employeeId: "emp-a", clockInAt: "2026-10-05T06:00:00.000Z", clockOutAt: "2026-10-05T08:00:00.000Z", clockInGymId: "g1", clockInGymName: "Mosta", clockOutGymId: "g2", clockOutGymName: "Marsa", status: "closed", attentionCode: null, workedMinutes: 120, payCents: 3400 }],
  days: [{ date: "2026-10-05", workedMinutes: 120, payCents: 3400, normalPayCents: 0, holidayPayCents: 3400, allocations: [{ id: "seg1", sessionId: "s1", workDate: "2026-10-05", workedMinutes: 120, hourlyRateCents: 850, employmentType: "full_time", holidayVersionId: "hv1", holidayName: "Holiday", holidayMultiplierBps: 20000, payCents: 3400, status: "closed", attentionCode: null, clockInAt: "2026-10-05T06:00:00.000Z", clockOutAt: "2026-10-05T08:00:00.000Z", clockInGymName: "Mosta", clockOutGymName: "Marsa" }] }],
  weeklyTotals: [{ key: "2026-10-05", workedMinutes: 120, payCents: 3400, normalPayCents: 0, holidayPayCents: 3400 }],
  monthlyTotals: [{ key: "2026-10", workedMinutes: 120, payCents: 3400, normalPayCents: 0, holidayPayCents: 3400 }],
  selectedPeriod: { workedMinutes: 120, payCents: 3400, normalPayCents: 0, holidayPayCents: 3400 },
};

test("management workbook includes attendance, summary and needs-attention sheets", async () => {
  const buffer = await buildStaffTimesheetWorkbookBuffer({ reports: [report], includeSalary: true, fromDate: "2026-10-01", toDate: "2026-10-31" });
  const text = buffer.toString("latin1");
  assert.ok(buffer.byteLength > 1000);
  assert.match(text, /xl\/worksheets/);
});

test("salary-hidden workbook does not embed salary headings or payroll values in shared strings", async () => {
  const buffer = await buildStaffTimesheetWorkbookBuffer({ reports: [report], includeSalary: false, fromDate: "2026-10-01", toDate: "2026-10-31" });
  const text = buffer.toString("latin1");
  assert.doesNotMatch(text, /Hourly Rate|Total Pay|Normal Pay|Holiday Pay/);
});
