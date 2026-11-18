import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}
export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return fail("TEST unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  try {
    const result = await getSupabaseAdmin().from("bgm_gyms")
      .select("id,name,status,hu20_punch_clock_enabled").order("name");
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, fictionalTestOnly: true, gyms: result.data || [] }, { headers });
  } catch (error) {
    console.error("HU20 TEST gym rollout listing failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to load TEST gym rollout.", 500);
  }
}
export async function PATCH(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return fail("TEST unavailable.", 404);
  const auth = await requireSuperAdmin(request);
  if (auth.error || !auth.context) return auth.error;
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return fail("JSON required.", 415);
  try {
    const raw = await request.text();
    if (raw.length > 300) return fail("Request too large.", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 2 || !("gymId" in body) || !("enabled" in body) ||
        typeof body.gymId !== "string" || !/^[a-zA-Z0-9_-]{2,120}$/.test(body.gymId) ||
        typeof body.enabled !== "boolean") return fail("Invalid TEST gym toggle.", 400);
    const updated = await getSupabaseAdmin().rpc("bgm_hu20_test_set_gym_rollout", {
      p_gym_id: body.gymId, p_enabled: body.enabled,
      p_actor_system_user_id: auth.context.systemUserId,
    });
    if (updated.error?.code === "P0001") return fail("Gym inactive, missing or access refused.", 409);
    if (updated.error) throw updated.error;
    const row = Array.isArray(updated.data) ? updated.data[0] : updated.data;
    if (!row || row.gym_id !== body.gymId || row.punch_clock_enabled !== body.enabled) {
      throw new Error("TEST rollout RPC failed to confirm change.");
    }
    return NextResponse.json({ ok: true, fictionalTestOnly: true, gymId: row.gym_id,
      punchClockEnabled: row.punch_clock_enabled }, { headers });
  } catch (error) {
    console.error("HU20 TEST gym rollout update failed", error instanceof Error ? error.name : "unknown");
    return fail("Could not change TEST gym rollout.", 500);
  }
}
