import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { writeStaffAudit } from "@/lib/staffEmploymentApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store, private, max-age=0" };
const ttlMillis = 10 * 60 * 1000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: responseHeaders });
}
function authorizedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
async function expireRequests() {
  const db = getSupabaseAdmin();
  const update = await db.from("bgm_hu20_enrollment_requests")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString());
  if (update.error) throw update.error;
}

export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return errorResponse("Unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    await expireRequests();
    const db = getSupabaseAdmin();
    const [requests, employees, terminals] = await Promise.all([
      db.from("bgm_hu20_enrollment_requests")
        .select("id,employee_id,terminal_id,status,created_at,expires_at,completed_at,cancelled_at")
        .order("created_at", { ascending: false }).limit(50),
      db.from("bgm_staff_employees").select("id,first_name,surname,active")
        .order("surname").order("first_name"),
      db.from("bgm_staff_terminals").select("id,name,gym_id,active")
        .order("name"),
    ]);
    if (requests.error) throw requests.error;
    if (employees.error) throw employees.error;
    if (terminals.error) throw terminals.error;
    return NextResponse.json({
      ok: true,
      requests: requests.data || [],
      employees: employees.data || [],
      terminals: terminals.data || [],
      note: "TEST supervised enrollment: authorised scanner uploads only after two matching fingerprint captures.",
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 enrollment request list failed", error);
    return errorResponse("Cannot load enrollment requests.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return errorResponse("Unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    if (!authorizedOrigin(request)) return errorResponse("Invalid request origin.", 403);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return errorResponse("JSON required.", 415);
    }
    const body = await request.json().catch(() => null);
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    if (!validHu20TerminalId(employeeId) || !validHu20TerminalId(terminalId)) {
      return errorResponse("Choose a valid TEST employee and terminal.", 400);
    }

    await expireRequests();
    const db = getSupabaseAdmin();
    const [employee, terminal, existing] = await Promise.all([
      db.from("bgm_staff_employees").select("id,active").eq("id", employeeId).maybeSingle(),
      db.from("bgm_staff_terminals").select("id,gym_id,active")
        .eq("id", terminalId).maybeSingle(),
      db.from("bgm_staff_biometrics").select("id")
        .eq("employee_id", employeeId).eq("active", true).eq("status", "enrolled").limit(1),
    ]);
    if (employee.error) throw employee.error;
    if (terminal.error) throw terminal.error;
    if (existing.error) throw existing.error;
    if (!employee.data?.active) return errorResponse("Employee must be active.", 409);
    if (!terminal.data?.active) return errorResponse("TEST terminal is inactive.", 409);
    if ((existing.data || []).length > 0) {
      return errorResponse("Employee already has an active fingerprint. Revoke before re-enrollment.", 409);
    }
    const gym = await db.from("bgm_gyms").select("status")
      .eq("id", terminal.data.gym_id).maybeSingle();
    if (gym.error) throw gym.error;
    if (gym.data?.status !== "active") return errorResponse("Terminal gym must be active.", 409);

    const created = await db.from("bgm_hu20_enrollment_requests").insert({
      employee_id: employeeId,
      terminal_id: terminalId,
      initiated_by_system_user_id: auth.context.systemUserId,
      status: "pending",
      expires_at: new Date(Date.now() + ttlMillis).toISOString(),
      metadata: { scope: "test", template_upload_enabled: false },
    }).select("id,employee_id,terminal_id,status,expires_at").single();
    if (created.error?.code === "23505") return errorResponse("An enrollment request is already pending for this employee.", 409);
    if (created.error) throw created.error;
    try {
      await writeStaffAudit(auth.context, {
        actionKey: "staff.hu20.enrollment.requested",
        entityType: "staff_hu20_enrollment_request",
        entityId: created.data.id,
        contextGymId: terminal.data.gym_id,
        afterData: { employeeId, terminalId, status: "pending", expiresAt: created.data.expires_at },
      });
    } catch (error) {
      // Fail closed: a request must not survive if its creation was not audited.
      await db.from("bgm_hu20_enrollment_requests").delete().eq("id", created.data.id);
      throw error;
    }
    return NextResponse.json({ ok: true, request: created.data }, { status: 201, headers: responseHeaders });
  } catch (error) {
    console.error("HU20 enrollment request creation failed", error);
    return errorResponse("Cannot create TEST enrollment request.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return errorResponse("Unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    if (!authorizedOrigin(request)) return errorResponse("Invalid request origin.", 403);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return errorResponse("JSON required.", 415);
    }
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (body?.action !== "cancel" || !validHu20TerminalId(id)) {
      return errorResponse("Valid request ID and cancel action required.", 400);
    }
    const db = getSupabaseAdmin();
    const found = await db.from("bgm_hu20_enrollment_requests")
      .select("id,terminal_id,status").eq("id", id).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) return errorResponse("Enrollment request not found.", 404);
    if (found.data.status !== "pending") return errorResponse("Request is no longer pending.", 409);
    const cancelled = await db.from("bgm_hu20_enrollment_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id).eq("status", "pending").select("id,status").maybeSingle();
    if (cancelled.error) throw cancelled.error;
    if (!cancelled.data) return errorResponse("Request has already changed.", 409);
    await writeStaffAudit(auth.context, {
      actionKey: "staff.hu20.enrollment.cancelled",
      entityType: "staff_hu20_enrollment_request",
      entityId: id,
      afterData: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true, request: cancelled.data }, { headers: responseHeaders });
  } catch (error) {
    console.error("HU20 enrollment cancellation failed", error);
    return errorResponse("Cannot cancel TEST enrollment request.", 500);
  }
}
