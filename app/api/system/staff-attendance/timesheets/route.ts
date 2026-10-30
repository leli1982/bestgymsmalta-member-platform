import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { queryStaffTimesheets } from "@/lib/staffTimesheetQueryServer";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function clean(value: string | null): string | null {
  const result = String(value || "").trim();
  return result || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const url = new URL(request.url);
    const fromDate = String(url.searchParams.get("fromDate") || url.searchParams.get("from") || "").trim();
    const toDate = String(url.searchParams.get("toDate") || url.searchParams.get("to") || "").trim();
    const data = await queryStaffTimesheets({
      fromDate,
      toDate,
      employeeId: clean(url.searchParams.get("employeeId")),
      homeGymId: clean(url.searchParams.get("homeGymId")),
      workedGymId: clean(url.searchParams.get("workedGymId")),
      status: clean(url.searchParams.get("status")),
    });
    return NextResponse.json({ ok: true, ...data }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load staff timesheets.";
    const status = /required|date|range|YYYY-MM-DD|after/i.test(message) ? 400 : 500;
    console.error("Could not load staff timesheets", error);
    return NextResponse.json({ ok: false, error: message }, { status, headers: noStore });
  }
}
