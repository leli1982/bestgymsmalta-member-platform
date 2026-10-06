import { NextRequest, NextResponse } from "next/server";
import { cleanStaffText, isUniqueViolation, optionalStaffText, writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function parseMultiplier(value: unknown, fallback: number, label: string) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer basis-point value.`);
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ holidayId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { holidayId } = await params;
    const body = await request.json();
    const db = getSupabaseAdmin();
    const [holidayResult, versionsResult] = await Promise.all([
      db.from("bgm_staff_public_holidays").select("id, holiday_date, created_at").eq("id", holidayId).maybeSingle(),
      db.from("bgm_staff_public_holiday_versions").select("id, holiday_id, version_no, name, full_time_multiplier_bps, part_time_multiplier_bps, active, note, effective_created_at, superseded_at, created_at").eq("holiday_id", holidayId).order("version_no", { ascending: false }),
    ]);
    if (holidayResult.error) throw holidayResult.error;
    if (versionsResult.error) throw versionsResult.error;
    if (!holidayResult.data) return bad("Staff public holiday not found.", 404);
    const versions = versionsResult.data || [];
    const current = versions.find((version) => version.active && !version.superseded_at) || versions[0] || null;
    if (!current) return bad("This public holiday has no version to supersede.", 409);

    const name = body.name === undefined ? current.name : cleanStaffText(body.name);
    if (!name) return bad("Public-holiday name is required.");
    let fullTimeMultiplierBps: number;
    let partTimeMultiplierBps: number;
    try {
      fullTimeMultiplierBps = parseMultiplier(body.fullTimeMultiplierBps, current.full_time_multiplier_bps, "Full Time multiplier");
      partTimeMultiplierBps = parseMultiplier(body.partTimeMultiplierBps, current.part_time_multiplier_bps, "Part Time multiplier");
    } catch (error) {
      return bad(error instanceof Error ? error.message : "Invalid public-holiday multiplier.");
    }
    if (body.active !== undefined && typeof body.active !== "boolean") return bad("Active state must be true or false.");
    const nextActive = body.active === undefined ? true : body.active;
    const note = body.note === undefined ? current.note : optionalStaffText(body.note);
    const nextVersionNo = Math.max(...versions.map((version) => Number(version.version_no)), 0) + 1;
    const now = new Date().toISOString();

    const supersede = await db.from("bgm_staff_public_holiday_versions").update({
      active: false,
      superseded_at: now,
    }).eq("id", current.id);
    if (supersede.error) throw supersede.error;

    const inserted = await db.from("bgm_staff_public_holiday_versions").insert({
      holiday_id: holidayId,
      version_no: nextVersionNo,
      name,
      full_time_multiplier_bps: fullTimeMultiplierBps,
      part_time_multiplier_bps: partTimeMultiplierBps,
      active: nextActive,
      note,
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, holiday_id, version_no, name, full_time_multiplier_bps, part_time_multiplier_bps, active, note, effective_created_at, superseded_at, created_at").single();

    if (inserted.error) {
      await db.from("bgm_staff_public_holiday_versions").update({
        active: current.active,
        superseded_at: current.superseded_at,
      }).eq("id", current.id);
      if (isUniqueViolation(inserted.error)) return bad("The public holiday changed at the same time. Refresh and try again.", 409);
      throw inserted.error;
    }

    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.holiday.versioned",
        entityType: "staff_public_holiday",
        entityId: holidayId,
        beforeData: { holiday: holidayResult.data, version: current },
        afterData: { holiday: holidayResult.data, version: inserted.data },
      });
    } catch (error) {
      await db.from("bgm_staff_public_holiday_versions").delete().eq("id", inserted.data.id);
      await db.from("bgm_staff_public_holiday_versions").update({ active: current.active, superseded_at: current.superseded_at }).eq("id", current.id);
      throw error;
    }

    return NextResponse.json({ ok: true, holiday: holidayResult.data, version: inserted.data }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not version the staff public holiday." }, { status: 500, headers: noStore });
  }
}
