import { NextRequest, NextResponse } from "next/server";
import { hu20RealStaffPilotEnabled } from "@/lib/hu20RealStaffPilot";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private, max-age=0" };
const fail = (message: string, status: number) => NextResponse.json({ ok: false, error: message }, { status, headers });

export async function GET(request: NextRequest) {
  if (!hu20RealStaffPilotEnabled()) return fail("Real-staff pilot unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  const id = new URL(request.url).searchParams.get("employeeId");
  if (!id || !validHu20TerminalId(id)) return fail("Valid employee required.", 400);
  try {
    const db = getSupabaseAdmin();
    const [person, enabled] = await Promise.all([
      db.from("bgm_staff_employees")
        .select("id,active,id_number").eq("id",id).maybeSingle(),
      db.from("bgm_hu20_real_staff_pilot")
        .select("employee_id,enabled,changed_at").eq("employee_id",id).maybeSingle(),
    ]);
    if (person.error) throw person.error;
    if (enabled.error) throw enabled.error;
    if (!person.data || person.data.id_number?.startsWith("HU20-TEST-"))
      return fail("Only real staff profiles are eligible.",409);
    return NextResponse.json({
      ok: true, testOnly: true, employeeId: id, employeeActive: person.data.active,
      pilotEnabled: enabled.data?.enabled === true, lastChangedAt: enabled.data?.changed_at ?? null,
    }, { headers });
  } catch (error) {
    console.error("HU20 TEST real staff pilot status failed",error instanceof Error ? error.name : "unknown");
    return fail("Cannot read real-staff pilot authorisation.",500);
  }
}

export async function POST(request: NextRequest) {
  if (!hu20RealStaffPilotEnabled()) return fail("Real-staff pilot unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail("Invalid request origin.",403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json"))
    return fail("JSON required.",415);
  try {
    const raw=await request.text();
    if (raw.length>256) return fail("Request too large.",413);
    const body: unknown=JSON.parse(raw);
    if (!body || typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).length!==2 || !("employeeId" in body) || !("enabled" in body) ||
      typeof body.employeeId!=="string" || !validHu20TerminalId(body.employeeId) ||
      typeof body.enabled!=="boolean") return fail("Invalid pilot activation.",400);
    const result=await getSupabaseAdmin().rpc("bgm_hu20_pilot_set_employee_enabled",{
      p_employee_id:body.employeeId, p_enabled:body.enabled,
      p_actor_system_user_id:auth.context.systemUserId
    });
    if (result.error?.code==="P0001") return fail("Employee cannot be activated.",409);
    if (result.error) throw result.error;
    const confirmed=Array.isArray(result.data)?result.data[0]:result.data;
    if (!confirmed || confirmed.employee_id!==body.employeeId ||
        confirmed.enabled!==body.enabled) throw new Error("Pilot authorisation not confirmed.");
    return NextResponse.json({ok:true,testOnly:true,employeeId:confirmed.employee_id,
      pilotEnabled:confirmed.enabled}, {headers});
  } catch (error) {
    console.error("HU20 TEST pilot change failed",error instanceof Error ? error.name : "unknown");
    return fail("Unable to change pilot status.",500);
  }
}
