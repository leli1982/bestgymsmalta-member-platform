import { NextRequest, NextResponse } from "next/server";
import { authenticateHu20Terminal, isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

// Separately enabled, fictional-only attendance. The existing recognition
// endpoint remains diagnostic: it never punches.
function enabled() {
  return isHu20TestRequestEnabled() &&
    process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true" &&
    process.env.BGM_HU20_ATTENDANCE_TEST_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) return fail("Unauthorised TEST terminal.", 401);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return fail("JSON required.", 415);
    }
    const raw = await request.text();
    if (raw.length > 512) return fail("Request too large.", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !("testId" in body) || typeof body.testId !== "string" ||
        !validHu20TerminalId(body.testId.trim())) {
      return fail("Valid TEST recognition ID required.", 400);
    }
    const db = getSupabaseAdmin();
    const recorded = await db.rpc("bgm_hu20_test_record_attendance", {
      p_test_id: body.testId.trim(),
      p_terminal_id: terminal.id,
    });
    if (recorded.error?.code === "P0001") {
      return fail("TEST punch rejected: recognition missing, expired, revoked or already invalid.", 409);
    }
    if (recorded.error) throw recorded.error;
    const result = Array.isArray(recorded.data) ? recorded.data[0] : recorded.data;
    if (!result || !["clocked_in", "clocked_out", "duplicate_ignored"].includes(result.outcome)) {
      throw new Error("Invalid fictional TEST attendance outcome.");
    }
    return NextResponse.json({
      ok: true, fictionalTestOnly: true,
      outcome: result.outcome,
      employeeId: result.result_employee_id,
      sessionId: result.result_session_id,
      punchEventId: result.result_punch_event_id,
      gymId: result.result_gym_id,
    }, { headers });
  } catch (error) {
    console.error("HU20 fictional TEST attendance failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to process fictional TEST attendance.", 500);
  }
}
