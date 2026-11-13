import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const durationMillis = 10 * 60 * 1000;
const maxScans = 6;

function enabled() {
  return isHu20TestRequestEnabled() &&
    process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true" &&
    process.env.BGM_HU20_ATTENDANCE_TEST_ENABLED === "true" &&
    process.env.BGM_HU20_KIOSK_TEST_ENABLED === "true";
}
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}
function validOrigin(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
async function expireOld() {
  const response = await getSupabaseAdmin().from("bgm_hu20_test_kiosk_windows")
    .update({ status: "expired" }).eq("status", "active")
    .lte("expires_at", new Date().toISOString());
  if (response.error) throw response.error;
}

/** Super Admin authorises short-lived testing windows, not indefinite background punches. */
export async function GET(request: NextRequest) {
  if (!enabled()) return fail("HU20 kiosk is disabled outside the separate TEST Preview.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  try {
    await expireOld();
    const result = await getSupabaseAdmin().from("bgm_hu20_test_kiosk_windows")
      .select("id,terminal_id,status,created_at,expires_at,scans_used,max_scans")
      .order("created_at", { ascending: false }).limit(30);
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, fictionalTestOnly: true, windows: result.data || [] }, { headers });
  } catch (error) {
    console.error("HU20 TEST kiosk window listing failed", error instanceof Error ? error.name : "unknown");
    return fail("Cannot load TEST kiosk windows.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!enabled()) return fail("TEST kiosk disabled.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (!validOrigin(request)) return fail("Invalid origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return fail("JSON required.", 415);
  const raw = await request.text();
  if (raw.length > 256) return fail("Request too large.", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail("Invalid JSON.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("terminalId" in body) ||
      typeof body.terminalId !== "string" || !validHu20TerminalId(body.terminalId)) {
    return fail("Valid registered TEST terminal required.", 400);
  }
  const terminalId = body.terminalId.trim();
  try {
    const db = getSupabaseAdmin();
    await expireOld();
    const terminal = await db.from("bgm_staff_terminals")
      .select("id,active,gym_id").eq("id", terminalId).maybeSingle();
    if (terminal.error) throw terminal.error;
    if (!terminal.data?.active) return fail("TEST terminal is inactive.", 409);
    const gym = await db.from("bgm_gyms")
      .select("status").eq("id",terminal.data.gym_id).maybeSingle();
    if (gym.error) throw gym.error;
    if (gym.data?.status !== "active") return fail("TEST terminal gym is inactive.", 409);
    const expiresAt = new Date(Date.now() + durationMillis).toISOString();
    const created = await db.from("bgm_hu20_test_kiosk_windows").insert({
      terminal_id: terminalId,
      initiated_by_system_user_id: auth.context.systemUserId,
      status: "active", expires_at: expiresAt, max_scans: maxScans,
    }).select("id,terminal_id,status,created_at,expires_at,scans_used,max_scans").single();
    if (created.error?.code === "23505") return fail("A TEST kiosk window is already active. Stop it first.", 409);
    if (created.error) throw created.error;
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      action_key: "staff.hu20.kiosk.started.test",
      entity_type: "staff_hu20_test_kiosk_window",
      entity_id: created.data.id,
      after_data: { terminalId, expiresAt, maxScans, fictionalTestOnly: true },
    });
    if (audit.error) {
      await db.from("bgm_hu20_test_kiosk_windows")
        .update({ status: "cancelled" }).eq("id", created.data.id).eq("status", "active");
      throw audit.error;
    }
    return NextResponse.json({ ok: true, fictionalTestOnly: true, window: created.data }, { status: 201, headers });
  } catch (error) {
    console.error("HU20 TEST kiosk authorisation failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to authorise TEST kiosk.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!enabled()) return fail("TEST kiosk disabled.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (!validOrigin(request)) return fail("Invalid origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return fail("JSON required.", 415);
  const raw = await request.text();
  if (raw.length > 256) return fail("Request too large.", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail("Invalid JSON.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      !("id" in body) || !("action" in body) ||
      typeof body.id !== "string" || !validHu20TerminalId(body.id) ||
      body.action !== "stop") return fail("Invalid kiosk cancellation.", 400);
  try {
    const db = getSupabaseAdmin();
    const stopped = await db.from("bgm_hu20_test_kiosk_windows")
      .update({ status: "cancelled" }).eq("id", body.id)
      .eq("status", "active")
      .select("id,terminal_id,status").maybeSingle();
    if (stopped.error) throw stopped.error;
    if (!stopped.data) return fail("Kiosk window has already ended.", 409);
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      action_key: "staff.hu20.kiosk.stopped.test",
      entity_type: "staff_hu20_test_kiosk_window",
      entity_id: stopped.data.id,
      after_data: { terminalId: stopped.data.terminal_id, fictionalTestOnly: true, status: "cancelled" },
    });
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true, fictionalTestOnly: true, stopped: stopped.data }, { headers });
  } catch (error) {
    console.error("HU20 TEST kiosk cancellation failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to stop TEST kiosk.", 500);
  }
}
