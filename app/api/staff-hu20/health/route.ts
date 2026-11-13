import { NextRequest, NextResponse } from "next/server";
import { authenticateHu20Terminal, isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) {
    return NextResponse.json({ ok: false, error: "Unavailable." }, { status: 404, headers });
  }
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) {
      return NextResponse.json({ ok: false, error: "Unauthorised terminal." }, { status: 401, headers });
    }
    const db = getSupabaseAdmin();
    const ping = await db.from("bgm_staff_terminals")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", terminal.id)
      .eq("active", true);
    if (ping.error) throw ping.error;
    return NextResponse.json({
      ok: true,
      terminal: { id: terminal.id, name: terminal.name, gymId: terminal.gymId },
      punchEnabled: false,
      biometricRosterEnabled: false,
      message: "HU20 authenticated. Fingerprint attendance remains disabled in this phase.",
    }, { headers });
  } catch (error) {
    console.error("HU20 health check failed", error);
    return NextResponse.json({ ok: false, error: "Terminal health check failed." }, { status: 500, headers });
  }
}
