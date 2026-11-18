import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}
function enabled() {
  // This second flag applies ONLY to the isolated TEST Preview and never to Production.
  return isHu20TestRequestEnabled() &&
    process.env.BGM_HU20_REAL_STAFF_PILOT_ENABLED === "true";
}
export async function GET(request: NextRequest) {
  if (!enabled()) return fail("TEST approval unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  const employeeId = request.nextUrl.searchParams.get("employeeId") || "";
  if (!validHu20TerminalId(employeeId)) return fail("Invalid employee.", 400);
  try {
    const db = getSupabaseAdmin();
    const employee = await db.from("bgm_staff_employees")
      .select("id,id_number,active,home_gym_id").eq("id", employeeId).maybeSingle();
    if (employee.error) throw employee.error;
    if (!employee.data || employee.data.id_number.startsWith("HU20-TEST-")) {
      return fail("Real employee not found.", 404);
    }
    const approved = await db.from("bgm_hu20_real_staff_pilot_approvals")
      .select("approved,updated_at").eq("employee_id", employeeId).maybeSingle();
    if (approved.error) throw approved.error;
    return NextResponse.json({
      ok: true, testOnly: true, employeeId,
      approved: approved.data?.approved === true,
      updatedAt: approved.data?.updated_at || null,
      employeeActive: employee.data.active === true,
      noBiometricCapture: true,
    }, { headers });
  } catch (error) {
    console.error("HU20 pilot approval status error", error instanceof Error ? error.name : "unknown");
    return fail("Cannot load HU20 TEST pilot approval.", 500);
  }
}
export async function POST(request: NextRequest) {
  if (!enabled()) return fail("TEST approval unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail("Invalid request origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json"))
    return fail("JSON required.", 415);
  try {
    const raw = await request.text();
    if (raw.length > 256) return fail("Request too large.", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 2 || !("employeeId" in body) ||
        !("approved" in body) || typeof body.employeeId !== "string" ||
        !validHu20TerminalId(body.employeeId) || typeof body.approved !== "boolean") {
      return fail("Invalid TEST pilot approval.", 400);
    }
    const result = await getSupabaseAdmin().rpc(
      "bgm_hu20_test_set_real_staff_pilot_approval", {
        p_employee_id: body.employeeId,
        p_approved: body.approved,
        p_actor_system_user_id: auth.context.systemUserId,
      });
    if (result.error?.code === "P0001") return fail("Employee is not eligible for approval.", 409);
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row || row.result_employee_id !== body.employeeId ||
        row.result_approved !== body.approved) {
      throw new Error("Approval transaction unconfirmed.");
    }
    return NextResponse.json({
      ok: true, testOnly: true, employeeId: row.result_employee_id,
      approved: row.result_approved, noBiometricCapture: true,
    }, { headers });
  } catch (error) {
    console.error("HU20 TEST pilot approval error", error instanceof Error ? error.name : "unknown");
    return fail("Cannot change HU20 TEST pilot approval.", 500);
  }
}
