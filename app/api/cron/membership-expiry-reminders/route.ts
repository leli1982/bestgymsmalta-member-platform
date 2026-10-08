import { NextRequest, NextResponse } from "next/server";
import { runMemberEngagementNotifications } from "@/lib/memberEngagementEngine";
import { runMembershipExpiryReminders } from "@/lib/membershipReminderEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type EngineOutcome<T> =
  | { ok: true; summary: T }
  | { ok: false; error: string };

async function runEngine<T>(
  name: string,
  work: () => Promise<T>,
): Promise<EngineOutcome<T>> {
  try {
    return { ok: true, summary: await work() };
  } catch (error) {
    console.error(`${name} cron failed:`, error);
    return { ok: false, error: `${name} run failed.` };
  }
}

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "Membership reminder cron is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [membershipReminders, memberEngagement] = await Promise.all([
    runEngine("Membership expiry reminder", () => runMembershipExpiryReminders()),
    runEngine("Member engagement notification", () => runMemberEngagementNotifications()),
  ]);
  const ok = membershipReminders.ok && memberEngagement.ok;

  return NextResponse.json(
    { ok, membershipReminders, memberEngagement },
    {
      status: ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
