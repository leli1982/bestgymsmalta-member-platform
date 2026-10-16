import ExcelJS from "exceljs";
import type { StaffTimesheetEmployeeReport } from "@/lib/staffTimesheetReport";
import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";

export type StaffTimesheetWorkbookInput = {
  reports: StaffTimesheetEmployeeReport[];
  includeSalary: boolean;
  fromDate: string;
  toDate: string;
};

function money(cents: number) { return cents / 100; }
function hours(minutes: number) { return Number((minutes / 60).toFixed(2)); }

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
}

export async function buildStaffTimesheetWorkbookBuffer(input: StaffTimesheetWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BestGymsMalta";
  workbook.created = new Date();
  const attendance = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 1 }] });
  const attendanceHeaders = ["Staff", "Home Gym", "Date", "IN", "IN Gym", "OUT", "OUT Gym", "Status", "Attention", "Worked Minutes", "Worked Hours"];
  if (input.includeSalary) attendanceHeaders.push("Hourly Rate", "Multiplier", "Normal Pay", "Holiday Pay", "Total Pay");
  attendance.addRow(attendanceHeaders); styleHeader(attendance.getRow(1));

  for (const report of input.reports) {
    for (const day of report.days) {
      for (const allocation of day.allocations) {
        const holiday = Boolean(allocation.holidayVersionId);
        const row: Array<string | number> = [
          report.employee.name,
          report.employee.homeGymName || "",
          formatEuropeanDate(day.date),
          formatEuropeanDateTime(allocation.clockInAt),
          allocation.clockInGymName || "",
          allocation.clockOutAt ? formatEuropeanDateTime(allocation.clockOutAt) : "OPEN",
          allocation.clockOutGymName || "",
          allocation.status,
          allocation.attentionCode || "",
          allocation.workedMinutes ?? "",
          allocation.workedMinutes === null ? "" : hours(allocation.workedMinutes),
        ];
        if (input.includeSalary) {
          row.push(
            allocation.hourlyRateCents === null ? "" : money(allocation.hourlyRateCents),
            allocation.holidayMultiplierBps === null ? "" : allocation.holidayMultiplierBps / 10000,
            allocation.payCents === null || holiday ? 0 : money(allocation.payCents),
            allocation.payCents === null || !holiday ? 0 : money(allocation.payCents),
            allocation.payCents === null ? "" : money(allocation.payCents),
          );
        }
        attendance.addRow(row);
      }
    }
  }
  attendance.columns.forEach((column, index) => { column.width = index === 0 ? 24 : 18; });
  attendance.getColumn(10).numFmt = "0";
  attendance.getColumn(11).numFmt = "0.00";
  if (input.includeSalary) {
    for (const index of [12, 14, 15, 16]) attendance.getColumn(index).numFmt = "€#,##0.00";
    attendance.getColumn(13).numFmt = "0.00x";
  }

  const summary = workbook.addWorksheet("Summary");
  const summaryHeaders = ["Staff", "Home Gym", "Period", "Worked Minutes", "Worked Hours"];
  if (input.includeSalary) summaryHeaders.push("Normal Pay", "Public Holiday Pay", "Total Pay");
  summary.addRow(summaryHeaders); styleHeader(summary.getRow(1));
  for (const report of input.reports) {
    const total = report.selectedPeriod;
    const row: Array<string | number> = [report.employee.name, report.employee.homeGymName || "", `${formatEuropeanDate(input.fromDate)} – ${formatEuropeanDate(input.toDate)}`, total.workedMinutes, hours(total.workedMinutes)];
    if (input.includeSalary) row.push(money(total.normalPayCents), money(total.holidayPayCents), money(total.payCents));
    summary.addRow(row);
  }
  summary.columns.forEach((column, index) => { column.width = index === 0 ? 24 : 20; });
  if (input.includeSalary) for (const index of [6, 7, 8]) summary.getColumn(index).numFmt = "€#,##0.00";

  const attention = workbook.addWorksheet("Needs Attention");
  attention.addRow(["Staff", "Date", "IN", "OUT", "Status", "Attention", "IN Gym", "OUT Gym"]); styleHeader(attention.getRow(1));
  for (const report of input.reports) {
    for (const session of report.sessions) {
      if (session.status !== "needs_attention" && !session.attentionCode) continue;
      attention.addRow([
        report.employee.name,
        formatEuropeanDate(session.clockInAt.slice(0, 10)),
        formatEuropeanDateTime(session.clockInAt),
        session.clockOutAt ? formatEuropeanDateTime(session.clockOutAt) : "OPEN",
        session.status,
        session.attentionCode || "",
        session.clockInGymName || "",
        session.clockOutGymName || "",
      ]);
    }
  }
  attention.columns.forEach((column, index) => { column.width = index === 0 ? 24 : 19; });

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}
