import { NextRequest, NextResponse } from "next/server";
import { effectiveRecordOn, type StaffEmploymentType } from "@/lib/staffAttendanceCore";
import {
  STAFF_EMPLOYEE_SELECT,
  cleanStaffText,
  isIsoCalendarDate,
  isUniqueViolation,
  normalizeStaffEmail,
  optionalStaffText,
  writeStaffAudit,
} from "@/lib/staffEmploymentApi";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function errorJson(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function currentByEmployee<T extends { employee_id: string; effective_from: string }>(
  rows: readonly T[],
  date: string
) {
  const grouped = new Map<string, Array<T & { effectiveFrom: string }>>();
  for (const row of rows) {
    const list = grouped.get(row.employee_id) || [];
    list.push({ ...row, effectiveFrom: row.effective_from });
    grouped.set(row.employee_id, list);
  }
  return new Map(
    Array.from(grouped.entries()).map(([employeeId, list]) => [employeeId, effectiveRecordOn(list, date)])
  );
}

function fingerprintByEmployee(rows: Array<{ employee_id: string; status: string; active: boolean; enrolled_at: string; revoked_at: string | null }>) {
  const map = new Map<string, "enrolled" | "pending" | "revoked" | "not_enrolled">();
  const sorted = [...rows].sort((a, b) => String(b.enrolled_at).localeCompare(String(a.enrolled_at)));
  for (const row of sorted) {
    if (map.has(row.employee_id)) continue;
    if (row.active && row.status === "enrolled") map.set(row.employee_id, "enrolled");
    else if (row.active && row.status === "pending") map.set(row.employee_id, "pending");
    else if (row.status === "revoked" || row.revoked_at) map.set(row.employee_id, "revoked");
  }
  return map;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const today = todayMaltaDate();
    const [employeesResult, ratesResult, typesResult, gymsResult, biometricsResult] = await Promise.all([
      db.from("bgm_staff_employees").select(STAFF_EMPLOYEE_SELECT).order("surname").order("first_name"),
      db.from("bgm_staff_rate_history").select("id, employee_id, hourly_rate_cents, effective_from, created_at").lte("effective_from", today),
      db.from("bgm_staff_employment_type_history").select("id, employee_id, employment_type, effective_from, created_at").lte("effective_from", today),
      db.from("bgm_gyms").select("id, name, status").order("name"),
      db.from("bgm_staff_biometrics").select("employee_id, status, active, enrolled_at, revoked_at").order("enrolled_at", { ascending: false }),
    ]);
    for (const result of [employeesResult, ratesResult, typesResult, gymsResult, biometricsResult]) {
      if (result.error) throw result.error;
    }
    const rates = currentByEmployee(ratesResult.data || [], today);
    const types = currentByEmployee(typesResult.data || [], today);
    const fingerprints = fingerprintByEmployee(biometricsResult.data || []);
    return NextResponse.json({
      asOfDate: today,
      employees: (employeesResult.data || []).map((employee) => ({
        id: employee.id,
        firstName: employee.first_name,
        surname: employee.surname,
        idNumber: employee.id_number,
        address: employee.address,
        mobile: employee.mobile,
        email: employee.email,
        homeGymId: employee.home_gym_id,
        hasPhoto: Boolean(employee.photo_path),
        fingerprintStatus: fingerprints.get(employee.id) || "not_enrolled",
        linkedSystemUserId: employee.linked_system_user_id,
        active: employee.active,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
        currentHourlyRateCents: rates.get(employee.id)?.hourly_rate_cents ?? null,
        currentRateEffectiveFrom: rates.get(employee.id)?.effective_from ?? null,
        currentEmploymentType: types.get(employee.id)?.employment_type ?? null,
        currentEmploymentTypeEffectiveFrom: types.get(employee.id)?.effective_from ?? null,
      })),
      gyms: gymsResult.data || [],
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load staff employees." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    const firstName = cleanStaffText(body.firstName);
    const surname = cleanStaffText(body.surname);
    const idNumber = cleanStaffText(body.idNumber);
    const homeGymId = cleanStaffText(body.homeGymId);
    const initialHourlyRateCents = Number(body.initialHourlyRateCents);
    const rateEffectiveFrom = cleanStaffText(body.rateEffectiveFrom);
    const initialEmploymentType = cleanStaffText(body.initialEmploymentType) as StaffEmploymentType;
    const employmentTypeEffectiveFrom = cleanStaffText(body.employmentTypeEffectiveFrom);

    if (!firstName || !surname || !idNumber || !homeGymId) {
      return errorJson("Name, surname, ID number and home gym are required.");
    }
    if (!Number.isInteger(initialHourlyRateCents) || initialHourlyRateCents < 0) {
      return errorJson("Initial hourly rate must be a non-negative integer number of cents.");
    }
    if (!isIsoCalendarDate(rateEffectiveFrom)) return errorJson("Choose a valid rate effective date.");
    if (!isIsoCalendarDate(employmentTypeEffectiveFrom)) return errorJson("Choose a valid employment-type effective date.");
    if (!(["full_time", "part_time"] as const).includes(initialEmploymentType)) {
      return errorJson("Employment type must be Full Time or Part Time.");
    }

    const db = getSupabaseAdmin();
    const gymResult = await db.from("bgm_gyms").select("id, name").eq("id", homeGymId).maybeSingle();
    if (gymResult.error) throw gymResult.error;
    if (!gymResult.data) return errorJson("Home gym not found.", 404);

    const employeeResult = await db.from("bgm_staff_employees").insert({
      first_name: firstName,
      surname,
      id_number: idNumber,
      address: optionalStaffText(body.address),
      mobile: optionalStaffText(body.mobile),
      email: normalizeStaffEmail(body.email),
      home_gym_id: homeGymId,
      active: body.active === undefined ? true : body.active === true,
      created_by_system_user_id: auth.context.systemUserId,
    }).select(STAFF_EMPLOYEE_SELECT).single();
    if (employeeResult.error) {
      if (isUniqueViolation(employeeResult.error)) return errorJson("A staff employee with this ID number already exists.", 409);
      throw employeeResult.error;
    }
    const employee = employeeResult.data;

    const cleanup = async () => {
      await db.from("bgm_staff_rate_history").delete().eq("employee_id", employee.id);
      await db.from("bgm_staff_employment_type_history").delete().eq("employee_id", employee.id);
      await db.from("bgm_staff_employees").delete().eq("id", employee.id);
    };

    const rateResult = await db.from("bgm_staff_rate_history").insert({
      employee_id: employee.id,
      hourly_rate_cents: initialHourlyRateCents,
      effective_from: rateEffectiveFrom,
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, employee_id, hourly_rate_cents, effective_from, created_at").single();
    if (rateResult.error) {
      await cleanup();
      throw rateResult.error;
    }

    const typeResult = await db.from("bgm_staff_employment_type_history").insert({
      employee_id: employee.id,
      employment_type: initialEmploymentType,
      effective_from: employmentTypeEffectiveFrom,
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, employee_id, employment_type, effective_from, created_at").single();
    if (typeResult.error) {
      await cleanup();
      throw typeResult.error;
    }

    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.employee.created",
        entityType: "staff_employee",
        entityId: employee.id,
        afterData: employee,
        contextGymId: homeGymId,
      });
      await writeStaffAudit(auth.context, {
        actionKey: "staff.rate.added",
        entityType: "staff_rate",
        entityId: rateResult.data.id,
        afterData: rateResult.data,
        contextGymId: homeGymId,
      });
      await writeStaffAudit(auth.context, {
        actionKey: "staff.employment_type.added",
        entityType: "staff_employment_type",
        entityId: typeResult.data.id,
        afterData: typeResult.data,
        contextGymId: homeGymId,
      });
    } catch (error) {
      await cleanup();
      throw error;
    }

    return NextResponse.json({ ok: true, employee, initialRate: rateResult.data, initialEmploymentType: typeResult.data }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create the staff employee." }, { status: 500, headers: noStore });
  }
}
