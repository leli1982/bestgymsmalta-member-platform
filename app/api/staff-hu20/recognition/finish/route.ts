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
export async function POST(request: NextRequest) {
  if (!isHu20TestRequestEnabled() || process.env.BGM_HU20_RECOGNITION_TEST_ENABLED !== "true") {
    return fail("Unavailable.", 404);
  }
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) return fail("Unauthorised terminal.", 401);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return fail("JSON required.", 415);
    }
    const raw = await request.text();
    if (raw.length > 2048) return fail("Result too large.",413);
    const body = JSON.parse(raw);
    const testId = typeof body?.testId === "string" ? body.testId.trim() : "";
    const credentialId = typeof body?.credentialId === "string" ? body.credentialId.trim() : null;
    const outcome = body?.result;
    if (!validHu20TerminalId(testId) ||
        !["one_match","no_match","ambiguous"].includes(outcome) ||
        (outcome === "one_match" && (!credentialId || !validHu20TerminalId(credentialId))) ||
        (outcome !== "one_match" && credentialId !== null)) {
      return fail("Invalid TEST identification result.", 400);
    }
    // RPC confirms credential is still enrolled/active at completion time:
    // revoked templates cannot be accepted even if a scan began earlier.
    const db = getSupabaseAdmin();
    const recorded = await db.rpc("bgm_hu20_test_finish_recognition", {
      p_test_id: testId,
      p_terminal_id: terminal.id,
      p_result: outcome,
      p_biometric_id: credentialId,
    });
    if (recorded.error?.code === "P0001") {
      return fail("Recognition expired, already used or biometric revoked.", 409);
    }
    if (recorded.error) throw recorded.error;
    const confirmed = Array.isArray(recorded.data) ? recorded.data[0] : recorded.data;
    if (!confirmed || confirmed.test_id !== testId || confirmed.result !== outcome) {
      throw new Error("TEST recognition not confirmed.");
    }
    return NextResponse.json({
      ok: true,
      result: confirmed.result,
      attendanceEnabled: false,
      noAttendanceWasRecorded: true,
    }, { headers });
  } catch (error) {
    console.error("HU20 TEST recognition completion failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to verify TEST identification.", 500);
  }
}
