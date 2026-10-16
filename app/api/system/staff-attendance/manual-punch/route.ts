import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordStaffPunch } from "@/lib/staffAttendanceServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: noStore });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json().catch(() => null);
    const employeeId = clean(body?.employeeId);
    const gymId = clean(body?.gymId);
    const reason = clean(body?.reason);
    const punchAtRaw = clean(body?.punchAt || body?.timestamp);

    if (!employeeId || !gymId || !reason || !punchAtRaw) {
      return errorResponse("Employee, gym, punch time and reason are required.");
    }

    const punchAt = new Date(punchAtRaw);
    if (Number.isNaN(punchAt.getTime())) {
      return errorResponse("A valid punch time is required.");
    }

    const db = getSupabaseAdmin();
    const gym = await db
      .from("bgm_gyms")
      .select("id, name, status")
      .eq("id", gymId)
      .maybeSingle();
    if (gym.error) throw gym.error;
    if (!gym.data) return errorResponse("Gym not found.", 404);
    if (String(gym.data.status || "").toLowerCase() !== "active") {
      return errorResponse("Manual punches can only use an active gym.", 409);
    }

    const punch = await recordStaffPunch({
      employeeId,
      eventKey: `staff-manual:${auth.context.systemUserId}:${randomUUID()}`,
      sourceTimestamp: punchAt,
      source: "manual",
      gymId,
      actorSystemUserId: auth.context.systemUserId,
      manualReason: reason,
    });

    if (punch.outcome === "inactive_employee") {
      return errorResponse("This employee is inactive.", 409);
    }
    if (punch.outcome === "invalid_request") {
      return errorResponse("The manual punch could not be applied.", 409);
    }

    return NextResponse.json(
      {
        ok: true,
        outcome: punch.outcome,
        sessionId: punch.sessionId,
        effectiveAt: punch.effectiveAt,
        gym: { id: gym.data.id, name: gym.data.name },
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Could not apply manual staff punch", error);
    return NextResponse.json(
      { ok: false, error: "Could not apply the manual punch." },
      { status: 500, headers: noStore },
    );
  }
}
