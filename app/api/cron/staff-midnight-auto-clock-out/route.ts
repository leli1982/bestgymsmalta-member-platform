import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Staff midnight auto clock-out cron is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const result = await supabase.rpc("bgm_staff_auto_close_midnight_sessions", {
      p_now: now,
    });
    if (result.error) throw result.error;

    const sessions = Array.isArray(result.data) ? result.data : [];
    return NextResponse.json(
      {
        ok: true,
        checkedAt: now,
        autoClosed: sessions.length,
        sessions,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Staff midnight auto clock-out cron failed:", error);
    return NextResponse.json(
      { ok: false, error: "Staff midnight auto clock-out failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
