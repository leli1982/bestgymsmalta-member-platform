import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { hu20RealStaffPilotEnabled } from "@/lib/hu20RealStaffPilot";

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
    const pilotEnabled = hu20RealStaffPilotEnabled();
    const baseQuery = db.from("bgm_staff_punch_events")
      .select("id,employee_id,action,gym_id,terminal_id,effective_minute_timestamp,created_at,event_key");
    const filtered = pilotEnabled
      ? baseQuery.or("event_key.like.hu20-test:%,event_key.like.hu20-pilot:%")
      : baseQuery.like("event_key", "hu20-test:%");
    const recent = await filtered.eq("source", "terminal")
      .order("created_at", { ascending: false }).limit(25);
    if (recent.error) throw recent.error;
    const punchRows = recent.data || [];
    if (punchRows.length === 0) {
      return NextResponse.json({ ok: true, fictionalTestOnly: !pilotEnabled, realStaffPilotEnabled: pilotEnabled, punches: [] }, { headers: responseHeaders });
    }

    const employeeIds = Array.from(new Set(punchRows.map((row) => row.employee_id)));
    const employees = await db.from("bgm_staff_employees")
      .select("id,first_name,surname,id_number")
      .in("id", employeeIds);
    if (employees.error) throw employees.error;
    const names = new Map((employees.data || []).map((row) => [
      row.id, { name: [row.first_name, row.surname].filter(Boolean).join(" ").trim(),
        fictional: row.id_number?.startsWith("HU20-TEST-") === true },
    ]));
    const visibleRows = punchRows.filter((row) => {
      const person = names.get(row.employee_id);
      if (!person) return false;
      return (person.fictional && row.event_key?.startsWith("hu20-test:")) ||
        (pilotEnabled && !person.fictional && row.event_key?.startsWith("hu20-pilot:"));
    });
    if (visibleRows.length === 0) {
      return NextResponse.json({ ok: true, fictionalTestOnly: !pilotEnabled, realStaffPilotEnabled: pilotEnabled, punches: [] }, { headers: responseHeaders });
    }

    const sessions = await db.from("bgm_staff_work_sessions")
      .select("id,employee_id,status,clock_in_punch_event_id,clock_out_punch_event_id,clock_in_at,clock_out_at")
      .in("employee_id", Array.from(new Set(visibleRows.map((row) => row.employee_id))))
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
      fictionalTestOnly: !pilotEnabled, realStaffPilotEnabled: pilotEnabled,
      punches: visibleRows.map((row) => ({
        id: row.id, employeeName: names.get(row.employee_id)?.name,
        realStaffPilot: row.event_key?.startsWith("hu20-pilot:") === true,
        action: row.action, gymId: row.gym_id,
        terminalId: row.terminal_id, at: row.effective_minute_timestamp,
        sessionStatus: linked.get(row.id)?.status || null,
        workedMinutes: linked.get(row.id)?.workedMinutes ?? null,
      })),
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 TEST punch audit query failed", error instanceof Error ? error.name : "unknown");
    return fail("Cannot load TEST punch history.", 500);
  }
}
