import { NextResponse } from "next/server";

import { supabaseServiceRole } from "@/lib/supabaseServer";

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

  const supabase = supabaseServiceRole();
  if (!supabase) {
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
    return NextResponse.json(
      { ok: false, code: "auto_clock_out_failed", error: error.message },
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
