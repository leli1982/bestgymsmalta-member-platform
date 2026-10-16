import type { StaffTimesheetEmployeeReport } from "@/lib/staffTimesheetReport";
import { formatEuropeanDate } from "@/lib/europeanDate";

export type StaffTimesheetEmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function hours(minutes: number) { return (minutes / 60).toFixed(2); }
function eur(cents: number) { return `€${(cents / 100).toFixed(2)}`; }
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}

export function buildStaffTimesheetEmailMessage(input: {
  report: StaffTimesheetEmployeeReport;
  includeSalary: boolean;
  fromDate: string;
  toDate: string;
}): StaffTimesheetEmailMessage {
  const email = String(input.report.employee.email || "").trim();
  if (!email) throw new Error(`Staff employee ${input.report.employee.name} has no email address.`);
  const period = `${formatEuropeanDate(input.fromDate)} – ${formatEuropeanDate(input.toDate)}`;
  const days = input.report.days || [];
  const lines = [
    `BestGymsMalta staff timesheet`,
    `Staff: ${input.report.employee.name}`,
    `Period: ${period}`,
    `Hours worked: ${hours(input.report.selectedPeriod.workedMinutes)}`,
  ];
  if (input.includeSalary) {
    lines.push(`Normal amount: ${eur(input.report.selectedPeriod.normalPayCents)}`);
    lines.push(`Public holiday amount: ${eur(input.report.selectedPeriod.holidayPayCents)}`);
    lines.push(`Total amount: ${eur(input.report.selectedPeriod.payCents)}`);
  }
  lines.push("", "Daily attendance:");
  for (const day of days) {
    lines.push(`${formatEuropeanDate(day.date)} — ${hours(day.workedMinutes)} hours`);
  }
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>BestGymsMalta staff timesheet</h2><p><strong>Staff:</strong> ${escapeHtml(input.report.employee.name)}<br><strong>Period:</strong> ${escapeHtml(period)}<br><strong>Hours worked:</strong> ${hours(input.report.selectedPeriod.workedMinutes)}</p>${input.includeSalary ? `<p><strong>Normal amount:</strong> ${eur(input.report.selectedPeriod.normalPayCents)}<br><strong>Public holiday amount:</strong> ${eur(input.report.selectedPeriod.holidayPayCents)}<br><strong>Total amount:</strong> ${eur(input.report.selectedPeriod.payCents)}</p>` : ""}<h3>Daily attendance</h3><ul>${days.map((day) => `<li>${formatEuropeanDate(day.date)} — ${hours(day.workedMinutes)} hours</li>`).join("")}</ul></div>`;
  return {
    to: email,
    subject: `BestGymsMalta timesheet — ${input.report.employee.name} — ${period}`,
    text,
    html,
  };
}
