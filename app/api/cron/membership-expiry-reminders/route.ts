import { NextRequest, NextResponse } from "next/server";
import { runMembershipExpiryReminders } from "@/lib/membershipReminderEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "Membership reminder cron is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await runMembershipExpiryReminders();
    return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Membership expiry reminder cron failed:", error);
    return NextResponse.json({ error: "Membership reminder run failed." }, { status: 500 });
  }
}
