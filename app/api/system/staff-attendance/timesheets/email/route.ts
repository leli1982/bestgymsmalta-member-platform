import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { queryStaffTimesheets } from "@/lib/staffTimesheetQueryServer";
import { buildStaffTimesheetEmailMessage } from "@/lib/staffTimesheetMailer";
import { buildStaffTimesheetWorkbookBuffer } from "@/lib/staffTimesheetWorkbook";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function clean(value: unknown): string | null {
  const result = typeof value === "string" ? value.trim() : "";
  return result || null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => null);
    const fromDate = String(body?.fromDate || "").trim();
    const toDate = String(body?.toDate || "").trim();
    const includeSalary = body?.includeSalary !== false;
    const requestedIds = Array.isArray(body?.employeeIds) ? body.employeeIds.map((value: unknown) => String(value || "").trim()).filter(Boolean) : [];
    const data = await queryStaffTimesheets({
      fromDate,
      toDate,
      employeeId: clean(body?.employeeId),
      homeGymId: clean(body?.homeGymId),
      workedGymId: clean(body?.workedGymId),
      status: clean(body?.status),
    });
    const reports = requestedIds.length > 0 ? data.reports.filter((report) => requestedIds.includes(report.employee.id)) : data.reports;
    const config = resolveOperationsMailConfig({ GMAIL_USER: process.env.GMAIL_USER, GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD, GMAIL_FROM: process.env.GMAIL_FROM });
    if (!config) throw new Error("Staff timesheet email is not configured.");
    const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: config.user, pass: config.appPassword } });
    const sent: Array<{ employeeId: string; email: string }> = [];
    const skipped: Array<{ employeeId: string; reason: string }> = [];
    const failed: Array<{ employeeId: string; reason: string }> = [];

    for (const report of reports) {
      if (!report.employee.email) {
        skipped.push({ employeeId: report.employee.id, reason: "Missing email address" });
        continue;
      }
      try {
        const message = buildStaffTimesheetEmailMessage({ report, includeSalary, fromDate, toDate });
        const workbook = await buildStaffTimesheetWorkbookBuffer({ reports: [report], includeSalary, fromDate, toDate });
        await transporter.sendMail({
          from: config.from,
          to: message.to,
          replyTo: config.user,
          subject: message.subject,
          text: message.text,
          html: message.html,
          attachments: [{ filename: `BGM-timesheet-${report.employee.name.replace(/[^a-z0-9]+/gi, "-")}-${fromDate}-to-${toDate}.xlsx`, content: workbook }],
        });
        sent.push({ employeeId: report.employee.id, email: message.to });
      } catch (error) {
        failed.push({ employeeId: report.employee.id, reason: error instanceof Error ? error.message : "Email failed" });
      }
    }

    return NextResponse.json({ ok: failed.length === 0, sent, skipped, failed }, { status: failed.length === 0 ? 200 : 207, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not email staff timesheets.";
    console.error("Could not email staff timesheets", error);
    return NextResponse.json({ ok: false, error: message }, { status: 400, headers: noStore });
  }
}
