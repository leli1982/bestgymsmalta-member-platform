import { NextRequest, NextResponse } from "next/server";
import { authenticateHu20Terminal, isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private, max-age=0", Pragma: "no-cache" };
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}
function enabled() {
  return isHu20TestRequestEnabled() &&
    process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true" &&
    process.env.BGM_HU20_ATTENDANCE_TEST_ENABLED === "true" &&
    process.env.BGM_HU20_KIOSK_TEST_ENABLED === "true";
}

// Read-only, terminal-authenticated preflight. NEVER claims recognition, fetches
// fingerprint templates or writes attendance. It cannot enable real payroll.
// The server rechecks this authority on each subsequent recognition/attendance.
export async function GET(request: NextRequest) {
  if (!enabled()) return fail("TEST kiosk unavailable.", 404);
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) return fail("TEST terminal inactive or unauthorised.", 401);
    const db = getSupabaseAdmin();
    const [gym, windows] = await Promise.all([
      db.from("bgm_gyms").select("id,name,status,hu20_punch_clock_enabled").eq("id", terminal.gymId).maybeSingle(),
      db.from("bgm_hu20_test_kiosk_windows")
        .select("id,expires_at,scans_used,max_scans")
        .eq("terminal_id", terminal.id).eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1),
    ]);
    if (gym.error) throw gym.error;
    if (windows.error) throw windows.error;
    if (!gym.data || gym.data.status !== "active" || gym.data.hu20_punch_clock_enabled !== true) return fail("Punch Clock is disabled for this TEST gym.", 409);
    const window = windows.data?.[0];
    if (!window || window.scans_used >= window.max_scans) {
      return fail("No active TEST kiosk window or attempts remaining.", 409);
    }
    return NextResponse.json({
      ok: true,
      fictionalTestOnly: true,
      terminal: { id: terminal.id, name: terminal.name, gymId: terminal.gymId, gymName: gym.data.name },
      window: { expiresAt: window.expires_at, scansRemaining: window.max_scans - window.scans_used },
      recognitionAuthorisationConsumed: false,
      attendanceRecorded: false,
      restartRequiresManualApproval: true,
    }, { headers });
  } catch (error) {
    console.error("HU20 TEST startup preflight failed", error instanceof Error ? error.name : "unknown");
    return fail("Could not verify TEST terminal readiness.", 500);
  }
}
