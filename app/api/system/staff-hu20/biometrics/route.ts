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

export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return fail("Unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const data = await db.from("bgm_staff_biometrics")
      .select("id,employee_id,status,active,enrolled_at")
      .eq("adapter_key", "secugen-hu20-ansi378-v1")
      .eq("active", true).eq("status", "enrolled")
      .order("enrolled_at", { ascending: false }).limit(100);
    if (data.error) throw data.error;
    return NextResponse.json({ ok: true, biometrics: data.data || [] }, { headers });
  } catch (error) {
    console.error("HU20 biometric status failed", error instanceof Error ? error.name : "error");
    return fail("Cannot load HU20 enrollment status.", 500);
  }
}

/** Super Admin revoke: removes encrypted biometric material in one audited DB transaction. */
export async function PATCH(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return fail("Unavailable.", 404);
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return fail("Invalid request origin.", 403);
    }
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return fail("JSON required.", 415);
    }
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (body?.action !== "revoke" || !validHu20TerminalId(id)) {
      return fail("Invalid biometric revocation request.", 400);
    }
    const result = await getSupabaseAdmin().rpc("bgm_hu20_test_revoke_biometric", {
      p_biometric_id: id,
      p_actor_system_user_id: auth.context.systemUserId,
    });
    if (result.error?.code === "P0001") return fail("Biometric no longer active.", 409);
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, revokedId: id }, { headers });
  } catch (error) {
    console.error("HU20 biometric revocation failed", error instanceof Error ? error.name : "error");
    return fail("Cannot revoke TEST biometric.", 500);
  }
}
