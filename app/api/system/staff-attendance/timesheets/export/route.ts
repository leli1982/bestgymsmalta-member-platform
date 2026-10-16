import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { queryStaffTimesheets } from "@/lib/staffTimesheetQueryServer";
import { buildStaffTimesheetWorkbookBuffer } from "@/lib/staffTimesheetWorkbook";

export const dynamic = "force-dynamic";

function clean(value: string | null) { return String(value || "").trim() || null; }

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const url = new URL(request.url);
    const fromDate = String(url.searchParams.get("fromDate") || "").trim();
    const toDate = String(url.searchParams.get("toDate") || "").trim();
    const includeSalary = url.searchParams.get("includeSalary") !== "false";
    const data = await queryStaffTimesheets({
      fromDate,
      toDate,
      employeeId: clean(url.searchParams.get("employeeId")),
      homeGymId: clean(url.searchParams.get("homeGymId")),
      workedGymId: clean(url.searchParams.get("workedGymId")),
      status: clean(url.searchParams.get("status")),
    });
    const buffer = await buildStaffTimesheetWorkbookBuffer({ reports: data.reports, includeSalary, fromDate, toDate });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BGM-staff-timesheets-${fromDate}-to-${toDate}.xlsx"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export staff timesheets.";
    return NextResponse.json({ ok: false, error: message }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
