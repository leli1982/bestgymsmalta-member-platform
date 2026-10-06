import { NextRequest, NextResponse } from "next/server";
import { cleanStaffText, isIsoCalendarDate, isUniqueViolation, optionalStaffText, writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function multiplier(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer basis-point value.`);
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const [holidaysResult, versionsResult] = await Promise.all([
      db.from("bgm_staff_public_holidays").select("id, holiday_date, created_at").order("holiday_date"),
      db.from("bgm_staff_public_holiday_versions").select("id, holiday_id, version_no, name, full_time_multiplier_bps, part_time_multiplier_bps, active, note, effective_created_at, superseded_at, created_at").order("version_no", { ascending: false }),
    ]);
    if (holidaysResult.error) throw holidaysResult.error;
    if (versionsResult.error) throw versionsResult.error;
    return NextResponse.json({
      holidays: (holidaysResult.data || []).map((holiday) => {
        const versions = (versionsResult.data || []).filter((version) => version.holiday_id === holiday.id);
        return {
          id: holiday.id,
          holidayDate: holiday.holiday_date,
          createdAt: holiday.created_at,
          currentVersion: versions.find((version) => version.active && !version.superseded_at) || null,
          versions,
        };
      }),
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load staff public holidays." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    const holidayDate = cleanStaffText(body.holidayDate);
    const name = cleanStaffText(body.name);
    if (!isIsoCalendarDate(holidayDate)) return bad("Choose a valid public-holiday date.");
    if (!name) return bad("Public-holiday name is required.");
    let fullTimeMultiplierBps: number;
    let partTimeMultiplierBps: number;
    try {
      fullTimeMultiplierBps = multiplier(body.fullTimeMultiplierBps, "Full Time multiplier");
      partTimeMultiplierBps = multiplier(body.partTimeMultiplierBps, "Part Time multiplier");
    } catch (error) {
      return bad(error instanceof Error ? error.message : "Invalid public-holiday multiplier.");
    }

    const db = getSupabaseAdmin();
    const holidayResult = await db.from("bgm_staff_public_holidays").insert({ holiday_date: holidayDate }).select("id, holiday_date, created_at").single();
    if (holidayResult.error) {
      if (isUniqueViolation(holidayResult.error)) return bad("A public holiday already exists on this date.", 409);
      throw holidayResult.error;
    }
    const holiday = holidayResult.data;
    const versionResult = await db.from("bgm_staff_public_holiday_versions").insert({
      holiday_id: holiday.id,
      version_no: 1,
      name,
      full_time_multiplier_bps: fullTimeMultiplierBps,
      part_time_multiplier_bps: partTimeMultiplierBps,
      active: body.active === undefined ? true : body.active === true,
      note: optionalStaffText(body.note),
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, holiday_id, version_no, name, full_time_multiplier_bps, part_time_multiplier_bps, active, note, effective_created_at, superseded_at, created_at").single();
    if (versionResult.error) {
      await db.from("bgm_staff_public_holidays").delete().eq("id", holiday.id);
      throw versionResult.error;
    }
    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.holiday.created",
        entityType: "staff_public_holiday",
        entityId: holiday.id,
        afterData: { holiday, version: versionResult.data },
      });
    } catch (error) {
      await db.from("bgm_staff_public_holiday_versions").delete().eq("id", versionResult.data.id);
      await db.from("bgm_staff_public_holidays").delete().eq("id", holiday.id);
      throw error;
    }
    return NextResponse.json({ ok: true, holiday, version: versionResult.data }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create the staff public holiday." }, { status: 500, headers: noStore });
  }
}
