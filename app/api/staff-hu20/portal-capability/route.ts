import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
// No gymId parameter: the signed staff session determines its own gym.
// No information about other gyms or employees is returned.
export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return NextResponse.json({ ok: false }, { status: 404, headers });
  try {
    const context = await getSystemContext(request);
    if (!context) return NextResponse.json({ ok: false, error: "Login required." }, { status: 401, headers });
    if (!context.gymId) return NextResponse.json({
      ok: true, fictionalTestOnly: true, punchClockEnabled: false,
    }, { headers });
    const result = await getSupabaseAdmin().from("bgm_gyms")
      .select("status,hu20_punch_clock_enabled").eq("id", context.gymId).maybeSingle();
    if (result.error) throw result.error;
    return NextResponse.json({
      ok: true, fictionalTestOnly: true,
      punchClockEnabled: result.data?.status === "active" && result.data?.hu20_punch_clock_enabled === true,
    }, { headers });
  } catch (error) {
    console.error("HU20 TEST staff portal status failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "TEST status unavailable." }, { status: 500, headers });
  }
}
