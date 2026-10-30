import { NextRequest, NextResponse } from "next/server";
import { cleanStaffText, isIsoCalendarDate, isUniqueViolation, loadStaffEmployee, writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const body = await request.json();
    const hourlyRateCents = Number(body.hourlyRateCents);
    const effectiveFrom = cleanStaffText(body.effectiveFrom);
    if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0) {
      return NextResponse.json({ error: "Hourly rate must be a non-negative integer number of cents." }, { status: 400, headers: noStore });
    }
    if (!isIsoCalendarDate(effectiveFrom)) {
      return NextResponse.json({ error: "Choose a valid rate effective date." }, { status: 400, headers: noStore });
    }
    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) return NextResponse.json({ error: "Staff employee not found." }, { status: 404, headers: noStore });
    const result = await db.from("bgm_staff_rate_history").insert({
      employee_id: employeeId,
      hourly_rate_cents: hourlyRateCents,
      effective_from: effectiveFrom,
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, employee_id, hourly_rate_cents, effective_from, created_at").single();
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        return NextResponse.json({ error: "A rate already exists for this effective date." }, { status: 409, headers: noStore });
      }
      throw result.error;
    }
    await writeStaffAudit(auth.context, {
      actionKey: "staff.rate.added",
      entityType: "staff_rate",
      entityId: result.data.id,
      afterData: result.data,
      contextGymId: employee.home_gym_id,
    });
    return NextResponse.json({ ok: true, rate: result.data }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not add the staff hourly rate." }, { status: 500, headers: noStore });
  }
}
