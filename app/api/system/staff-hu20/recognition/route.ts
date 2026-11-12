import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const duration = 5 * 60 * 1000;

function enabled() {
  return isHu20TestRequestEnabled() && process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true";
}
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: responseHeaders });
}
function validOrigin(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
async function expirePending() {
  const response = await getSupabaseAdmin().from("bgm_hu20_recognition_tests")
    .update({ status: "expired" }).eq("status", "pending")
    .lte("expires_at", new Date().toISOString());
  if (response.error) throw response.error;
}

export async function GET(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  try {
    await expirePending();
    const db = getSupabaseAdmin();
    const tests = await db.from("bgm_hu20_recognition_tests")
      .select("id,terminal_id,status,created_at,expires_at,claimed_at,completed_at,result")
      .order("created_at", { ascending: false }).limit(30);
    if (tests.error) throw tests.error;
    return NextResponse.json({ ok: true, tests: tests.data || [] }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 recognition TEST list failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to list TEST recognition sessions.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (!validOrigin(request)) return fail("Invalid origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return fail("JSON required.", 415);
  const body = await request.json().catch(() => null);
  const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
  if (!validHu20TerminalId(terminalId)) return fail("Select a valid terminal.", 400);
  try {
    const db = getSupabaseAdmin();
    await expirePending();
    const terminal = await db.from("bgm_staff_terminals")
      .select("id,active,gym_id").eq("id", terminalId).maybeSingle();
    if (terminal.error) throw terminal.error;
    if (!terminal.data?.active) return fail("Terminal is inactive or missing.", 409);
    const gym = await db.from("bgm_gyms")
      .select("status").eq("id",terminal.data.gym_id).maybeSingle();
    if (gym.error) throw gym.error;
    if (gym.data?.status !== "active") return fail("Terminal gym is inactive.", 409);
    const expiresAt = new Date(Date.now() + duration).toISOString();
    const created = await db.from("bgm_hu20_recognition_tests").insert({
      terminal_id: terminalId,
      initiated_by_system_user_id: auth.context.systemUserId,
      status: "pending",
      expires_at: expiresAt,
    }).select("id,terminal_id,status,expires_at").single();
    if (created.error?.code === "23505") return fail("A recognition test is already pending for this terminal.", 409);
    if (created.error) throw created.error;
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      action_key: "staff.hu20.recognition.authorised.test",
      entity_type: "staff_hu20_recognition_test",
      entity_id: created.data.id,
      after_data: { terminalId, expiresAt, testOnly: true, attendanceEnabled: false },
    });
    if (audit.error) {
      await db.from("bgm_hu20_recognition_tests").delete().eq("id", created.data.id);
      throw audit.error;
    }
    return NextResponse.json({ ok: true, test: created.data }, { status: 201, headers: responseHeaders });
  } catch (error) {
    console.error("HU20 recognition authorisation failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to authorise TEST recognition.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (!validOrigin(request)) return fail("Invalid origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return fail("JSON required.", 415);
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!validHu20TerminalId(id) || body?.action !== "cancel") return fail("Invalid cancellation.", 400);
  try {
    const db = getSupabaseAdmin();
    const cancelled = await db.from("bgm_hu20_recognition_tests")
      .update({ status: "cancelled" }).eq("id", id).eq("status","pending")
      .select("id,status").maybeSingle();
    if (cancelled.error) throw cancelled.error;
    if (!cancelled.data) return fail("Recognition test is no longer pending.", 409);
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      action_key: "staff.hu20.recognition.cancelled.test",
      entity_type: "staff_hu20_recognition_test",
      entity_id: id,
      after_data: { testOnly: true, status: "cancelled" },
    });
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 TEST recognition cancellation failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to cancel TEST recognition.", 500);
  }
}
