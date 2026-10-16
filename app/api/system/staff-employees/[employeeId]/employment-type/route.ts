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
    const employmentType = cleanStaffText(body.employmentType);
    const effectiveFrom = cleanStaffText(body.effectiveFrom);
    if (!(["full_time", "part_time"] as const).includes(employmentType as "full_time" | "part_time")) {
      return NextResponse.json({ error: "Employment type must be Full Time or Part Time." }, { status: 400, headers: noStore });
    }
    if (!isIsoCalendarDate(effectiveFrom)) {
      return NextResponse.json({ error: "Choose a valid employment-type effective date." }, { status: 400, headers: noStore });
    }
    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) return NextResponse.json({ error: "Staff employee not found." }, { status: 404, headers: noStore });
    const result = await db.from("bgm_staff_employment_type_history").insert({
      employee_id: employeeId,
      employment_type: employmentType,
      effective_from: effectiveFrom,
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, employee_id, employment_type, effective_from, created_at").single();
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        return NextResponse.json({ error: "An employment type already exists for this effective date." }, { status: 409, headers: noStore });
      }
      throw result.error;
    }
    await writeStaffAudit(auth.context, {
      actionKey: "staff.employment_type.added",
      entityType: "staff_employment_type",
      entityId: result.data.id,
      afterData: result.data,
      contextGymId: employee.home_gym_id,
    });
    return NextResponse.json({ ok: true, employmentType: result.data }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not add the staff employment type." }, { status: 500, headers: noStore });
  }
}
