import { NextRequest, NextResponse } from "next/server";
import {
  STAFF_EMPLOYEE_SELECT,
  cleanStaffText,
  isUniqueViolation,
  loadStaffEmployee,
  normalizeStaffEmail,
  optionalStaffText,
  writeStaffAudit,
} from "@/lib/staffEmploymentApi";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function responseError(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) return responseError("Staff employee not found.", 404);
    const today = todayMaltaDate();
    const [ratesResult, typesResult, gymResult] = await Promise.all([
      db.from("bgm_staff_rate_history").select("id, hourly_rate_cents, effective_from, created_at").eq("employee_id", employeeId).order("effective_from", { ascending: false }),
      db.from("bgm_staff_employment_type_history").select("id, employment_type, effective_from, created_at").eq("employee_id", employeeId).order("effective_from", { ascending: false }),
      employee.home_gym_id
        ? db.from("bgm_gyms").select("id, name, status").eq("id", employee.home_gym_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (ratesResult.error) throw ratesResult.error;
    if (typesResult.error) throw typesResult.error;
    if (gymResult.error) throw gymResult.error;
    const currentRate = (ratesResult.data || []).find((row) => row.effective_from <= today) || null;
    const currentType = (typesResult.data || []).find((row) => row.effective_from <= today) || null;
    return NextResponse.json({
      employee: {
        id: employee.id,
        firstName: employee.first_name,
        surname: employee.surname,
        idNumber: employee.id_number,
        address: employee.address,
        mobile: employee.mobile,
        email: employee.email,
        homeGymId: employee.home_gym_id,
        homeGym: gymResult.data,
        hasPhoto: Boolean(employee.photo_path),
        photoUrl: employee.photo_path ? `/api/system/staff-employees/${encodeURIComponent(employee.id)}/photo` : null,
        linkedSystemUserId: employee.linked_system_user_id,
        active: employee.active,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
        currentHourlyRateCents: currentRate?.hourly_rate_cents ?? null,
        currentRateEffectiveFrom: currentRate?.effective_from ?? null,
        currentEmploymentType: currentType?.employment_type ?? null,
        currentEmploymentTypeEffectiveFrom: currentType?.effective_from ?? null,
      },
      rateHistory: ratesResult.data || [],
      employmentTypeHistory: typesResult.data || [],
      asOfDate: today,
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load the staff employee." }, { status: 500, headers: noStore });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const body = await request.json();
    const db = getSupabaseAdmin();
    const before = await loadStaffEmployee(db, employeeId);
    if (!before) return responseError("Staff employee not found.", 404);

    const updates: Record<string, unknown> = {};
    if (body.firstName !== undefined) {
      const value = cleanStaffText(body.firstName);
      if (!value) return responseError("First name is required.");
      updates.first_name = value;
    }
    if (body.surname !== undefined) {
      const value = cleanStaffText(body.surname);
      if (!value) return responseError("Surname is required.");
      updates.surname = value;
    }
    if (body.idNumber !== undefined) {
      const value = cleanStaffText(body.idNumber);
      if (!value) return responseError("ID number is required.");
      updates.id_number = value;
    }
    if (body.address !== undefined) updates.address = optionalStaffText(body.address);
    if (body.mobile !== undefined) updates.mobile = optionalStaffText(body.mobile);
    if (body.email !== undefined) updates.email = normalizeStaffEmail(body.email);
    if (body.homeGymId !== undefined) {
      const value = cleanStaffText(body.homeGymId);
      if (!value) return responseError("Home gym is required.");
      const gym = await db.from("bgm_gyms").select("id").eq("id", value).maybeSingle();
      if (gym.error) throw gym.error;
      if (!gym.data) return responseError("Home gym not found.", 404);
      updates.home_gym_id = value;
    }
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return responseError("Active status must be true or false.");
      updates.active = body.active;
    }
    if (Object.keys(updates).length === 0) return responseError("No staff employee changes were supplied.");
    updates.updated_at = new Date().toISOString();

    const updatedResult = await db.from("bgm_staff_employees").update(updates).eq("id", employeeId).select(STAFF_EMPLOYEE_SELECT).single();
    if (updatedResult.error) {
      if (isUniqueViolation(updatedResult.error)) return responseError("A staff employee with this ID number already exists.", 409);
      throw updatedResult.error;
    }
    const after = updatedResult.data;
    await writeStaffAudit(auth.context, {
      actionKey: "staff.employee.updated",
      entityType: "staff_employee",
      entityId: employeeId,
      beforeData: before,
      afterData: after,
      contextGymId: after.home_gym_id,
    });
    if (before.active !== after.active) {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.employee.status_changed",
        entityType: "staff_employee",
        entityId: employeeId,
        beforeData: { active: before.active },
        afterData: { active: after.active },
        contextGymId: after.home_gym_id,
      });
    }
    return NextResponse.json({ ok: true, employee: after }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update the staff employee." }, { status: 500, headers: noStore });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { employeeId } = await params;
    const db = getSupabaseAdmin();
    const employee = await loadStaffEmployee(db, employeeId);
    if (!employee) return responseError("Staff employee not found.", 404);

    const historyTables = [
      "bgm_staff_punch_events",
      "bgm_staff_work_sessions",
      "bgm_staff_session_payroll_segments",
      "bgm_staff_attendance_adjustments",
      "bgm_staff_attendance_alerts",
      "bgm_staff_biometrics",
    ] as const;
    for (const table of historyTables) {
      const result = await db.from(table).select("id", { count: "exact", head: true }).eq("employee_id", employeeId);
      if (result.error) throw result.error;
      if ((result.count || 0) > 0) {
        return responseError("This staff employee has attendance, payroll or biometric history and cannot be deleted. Deactivate the employee instead so the history is preserved.", 409);
      }
    }

    const rateDelete = await db.from("bgm_staff_rate_history").delete().eq("employee_id", employeeId);
    if (rateDelete.error) throw rateDelete.error;
    const employmentDelete = await db.from("bgm_staff_employment_type_history").delete().eq("employee_id", employeeId);
    if (employmentDelete.error) throw employmentDelete.error;
    const deleted = await db.from("bgm_staff_employees").delete().eq("id", employeeId).select("id").maybeSingle();
    if (deleted.error) throw deleted.error;
    if (!deleted.data) return responseError("Staff employee not found.", 404);

    if (employee.photo_path) {
      const cleanup = await db.storage.from("bgm-staff-photos").remove([employee.photo_path]);
      if (cleanup.error) console.error("Could not remove deleted staff photo", cleanup.error);
    }
    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.employee.deleted",
        entityType: "staff_employee",
        entityId: employeeId,
        beforeData: employee,
        afterData: null,
        contextGymId: employee.home_gym_id,
      });
    } catch (auditError) {
      console.error("Staff employee deleted but audit write failed", auditError);
    }

    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not delete the staff employee." }, { status: 500, headers: noStore });
  }
}
