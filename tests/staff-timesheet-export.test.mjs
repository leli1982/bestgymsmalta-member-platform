import assert from "node:assert/strict";
import ExcelJS from "exceljs";
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

async function load(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function headings(sheet) { return sheet.getRow(1).values.slice(1).map(String); }

test("management workbook includes attendance, summary and needs-attention sheets", async () => {
  const buffer = await buildStaffTimesheetWorkbookBuffer({ reports: [report], includeSalary: true, fromDate: "2026-10-01", toDate: "2026-10-31" });
  const workbook = await load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet=>sheet.name), ["Attendance","Summary","Needs Attention"]);
  assert.ok(headings(workbook.getWorksheet("Attendance")).includes("Total Pay"));
  assert.ok(buffer.byteLength > 1000);
});

test("salary-hidden workbook omits salary headings and payroll columns entirely", async () => {
  const buffer = await buildStaffTimesheetWorkbookBuffer({ reports: [report], includeSalary: false, fromDate: "2026-10-01", toDate: "2026-10-31" });
  const workbook = await load(buffer);
  const allHeaders = workbook.worksheets.flatMap(headings).join(" | ");
  assert.doesNotMatch(allHeaders, /Hourly Rate|Total Pay|Normal Pay|Holiday Pay|Multiplier/);
});
