import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function enabled() {
  return isHu20TestRequestEnabled()
    && process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true"
    && process.env.BGM_HU20_ATTENDANCE_TEST_ENABLED === "true";
}
function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: responseHeaders });
}

/** Read-only, Super Admin-only TEST audit view. Never return templates or terminal credentials. */
export async function GET(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;

  try {
    const db = getSupabaseAdmin();
    const recent = await db.from("bgm_staff_punch_events")
      .select("id,employee_id,action,gym_id,terminal_id,effective_minute_timestamp,created_at")
      .like("event_key", "hu20-test:%")
      .eq("source", "terminal")
      .order("created_at", { ascending: false })
      .limit(25);
    if (recent.error) throw recent.error;
    const punchRows = recent.data || [];
    if (punchRows.length === 0) {
      return NextResponse.json({ ok: true, fictionalTestOnly: true, punches: [] }, { headers: responseHeaders });
    }

    const employeeIds = [...new Set(punchRows.map((row) => row.employee_id))];
    const employees = await db.from("bgm_staff_employees")
      .select("id,first_name,surname")
      .in("id", employeeIds)
      .like("id_number", "HU20-TEST-%");
    if (employees.error) throw employees.error;
    const names = new Map((employees.data || []).map((row) => [
      row.id, [row.first_name, row.surname].filter(Boolean).join(" ").trim(),
    ]));
    const fictionalRows = punchRows.filter((row) => names.has(row.employee_id));
    if (fictionalRows.length === 0) {
      return NextResponse.json({ ok: true, fictionalTestOnly: true, punches: [] }, { headers: responseHeaders });
    }

    const sessions = await db.from("bgm_staff_work_sessions")
      .select("id,employee_id,status,clock_in_punch_event_id,clock_out_punch_event_id,clock_in_at,clock_out_at")
      .in("employee_id", [...new Set(fictionalRows.map((row) => row.employee_id))])
      .order("clock_in_at", { ascending: false })
      .limit(100);
    if (sessions.error) throw sessions.error;
    const linked = new Map<string, { status: string; workedMinutes: number | null }>();
    for (const session of sessions.data || []) {
      const duration = session.clock_in_at && session.clock_out_at
        ? Math.round((Date.parse(session.clock_out_at) - Date.parse(session.clock_in_at)) / 60000)
        : null;
      const item = { status: session.status, workedMinutes: duration };
      if (session.clock_in_punch_event_id) linked.set(session.clock_in_punch_event_id, item);
      if (session.clock_out_punch_event_id) linked.set(session.clock_out_punch_event_id, item);
    }

    return NextResponse.json({
      ok: true,
      fictionalTestOnly: true,
      punches: fictionalRows.map((row) => ({
        id: row.id, employeeName: names.get(row.employee_id),
        action: row.action, gymId: row.gym_id,
        terminalId: row.terminal_id, at: row.effective_minute_timestamp,
        sessionStatus: linked.get(row.id)?.status || null,
        workedMinutes: linked.get(row.id)?.workedMinutes ?? null,
      })),
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 fictional TEST punch audit query failed", error instanceof Error ? error.name : "unknown");
    return fail("Cannot load fictional TEST punch history.", 500);
  }
}
