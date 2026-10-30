import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAuthorised(request: Request) {
  const configuredSecret = (process.env.CRON_SECRET ?? "").trim();
  if (!configuredSecret) return false;
  return request.headers.get("authorization") === `Bearer ${configuredSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { ok: false, code: "cron_unauthorised" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error("Staff midnight auto clock-out cron is not configured:", error);
    return NextResponse.json(
      { ok: false, code: "server_misconfigured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase.rpc("bgm_staff_auto_close_midnight_sessions", {
    p_now: now,
  });

  if (error) {
    console.error("Staff midnight auto clock-out cron failed:", error);
    return NextResponse.json(
      { ok: false, code: "auto_clock_out_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      processedAt: now,
      closedSessions: Array.isArray(data) ? data : [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
