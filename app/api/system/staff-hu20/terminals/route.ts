import { NextRequest, NextResponse } from "next/server";
import { issueHu20TerminalSecret } from "@/lib/hu20TerminalSecurity";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private, max-age=0", "Pragma": "no-cache" };

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return responseError("HU20 test environment unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const [terminals, gyms] = await Promise.all([
      db.from("bgm_staff_terminals")
        .select("id, gym_id, name, active, vendor, model, created_at, last_seen_at")
        .order("created_at", { ascending: false }),
      db.from("bgm_gyms").select("id, name, status").order("name"),
    ]);
    if (terminals.error) throw terminals.error;
    if (gyms.error) throw gyms.error;
    return NextResponse.json({
      ok: true, terminals: terminals.data || [], gyms: gyms.data || [],
    }, { headers });
  } catch (error) {
    console.error("HU20 terminal list failed", error);
    return responseError("Cannot load HU20 terminals.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return responseError("HU20 test environment unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return responseError("Invalid request origin.", 403);
    }
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return responseError("JSON body required.", 415);
    }
    const body = await request.json().catch(() => null);
    const gymId = typeof body?.gymId === "string" ? body.gymId.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!gymId || gymId.length > 120 || name.length < 3 || name.length > 100) {
      return responseError("An active gym and terminal name (3–100 characters) are required.", 400);
    }
    const db = getSupabaseAdmin();
    const gym = await db.from("bgm_gyms").select("id, status").eq("id", gymId).maybeSingle();
    if (gym.error) throw gym.error;
    if (!gym.data || gym.data.status !== "active") {
      return responseError("Select an active TEST gym.", 409);
    }
    const issued = issueHu20TerminalSecret();
    const created = await db.from("bgm_staff_terminals").insert({
      gym_id: gymId,
      name,
      credential_hash: issued.credentialHash,
      active: true,
      vendor: "SecuGen",
      model: "Hamster Pro 20 (HU20)",
      metadata: { connection_protocol: "hu20-test-v1", test_only: true },
      created_by_system_user_id: auth.context.systemUserId,
    }).select("id, gym_id, name, active, created_at").single();
    if (created.error) throw created.error;
    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.hu20.terminal.created",
        entityType: "staff_terminal",
        entityId: created.data.id,
        contextGymId: gymId,
        afterData: {
          id: created.data.id, gymId, name, model: "HU20", testOnly: true,
        },
      });
    } catch (error) {
      // No credential should remain active if its creation was not audited.
      await db.from("bgm_staff_terminals").update({ active: false }).eq("id", created.data.id);
      throw error;
    }
    // Display secret ONCE. Never log it or put it in the audit trail.
    return NextResponse.json({
      ok: true,
      terminal: created.data,
      terminalSecret: issued.secret,
      warning: "Copy this secret to its PC now. It cannot be retrieved later.",
    }, { status: 201, headers });
  } catch (error) {
    console.error("HU20 terminal registration failed", error);
    return responseError("Could not register HU20 TEST terminal.", 500);
  }
}


// Emergency TEST-only terminal deactivation. No reactivation path is offered:
// replacement hardware must be registered with a NEW one-time secret.
// Authentication on every recognition/attendance step rejects disabled terminals.
export async function PATCH(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return responseError("HU20 test environment unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return responseError("Invalid request origin.", 403);
    }
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return responseError("JSON body required.", 415);
    }
    const raw = await request.text();
    if (raw.length > 256) return responseError("Request too large.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return responseError("Invalid JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 2 || !("id" in body) || !("action" in body) ||
        typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) ||
        body.action !== "deactivate") {
      return responseError("Valid TEST terminal deactivation required.", 400);
    }
    const db = getSupabaseAdmin();
    const terminal = await db.from("bgm_staff_terminals")
      .select("id,name,gym_id,active").eq("id", body.id).maybeSingle();
    if (terminal.error) throw terminal.error;
    if (!terminal.data?.active) return responseError("TEST terminal already inactive or missing.", 409);
    // Disable FIRST: any in-flight request must re-authenticate before an
    // attendance write, so no scan may succeed after deactivation.
    const disabled = await db.from("bgm_staff_terminals")
      .update({ active: false }).eq("id", terminal.data.id).eq("active", true)
      .select("id,name,gym_id,active").maybeSingle();
    if (disabled.error) throw disabled.error;
    if (!disabled.data) return responseError("TEST terminal already inactive.", 409);
    // Cancel all active kiosk windows, including ones waiting for a finger.
    const cancelled = await db.from("bgm_hu20_test_kiosk_windows")
      .update({ status: "cancelled" })
      .eq("terminal_id", disabled.data.id).eq("status", "active");
    if (cancelled.error) throw cancelled.error;
    await writeStaffAudit(auth.context, {
      actionKey: "staff.hu20.terminal.deactivated.test",
      entityType: "staff_terminal",
      entityId: disabled.data.id,
      contextGymId: disabled.data.gym_id,
      afterData: {
        id: disabled.data.id, gymId: disabled.data.gym_id,
        name: disabled.data.name, active: false, fictionalTestOnly: true,
      },
    });
    return NextResponse.json({
      ok: true, fictionalTestOnly: true,
      terminal: { id: disabled.data.id, active: false },
      windowRevocationRequested: true,
      replacementRequiresNewCredential: true,
    }, { headers });
  } catch (error) {
    // On audit failure the disabled credential MUST stay disabled.
    console.error("HU20 TEST terminal deactivation failed", error instanceof Error ? error.name : "unknown");
    return responseError("Terminal may be disabled; refresh its status before retrying.", 500);
  }
}
