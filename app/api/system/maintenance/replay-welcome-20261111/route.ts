import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWelcomePackagesBestEffort } from "@/lib/welcomePackage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-time incident-only maintenance endpoint. Remove after delivery verification.
// Secret is supplied through Vercel's encrypted Production environment variables,
// never in a URL or source. The date and application scope are immutable.
const REPLAY_DAY = "2026-11-11";
const START_UTC = "2026-11-10T23:00:00.000Z";
const END_UTC = "2026-11-11T23:00:00.000Z";
const SENT_AUDIT_ACTION = "membership.welcome_email.sent";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function authorized(request: NextRequest): boolean {
  const expected = process.env.BGM_ONE_OFF_WELCOME_REPLAY_TOKEN || "";
  const supplied = request.headers.get("x-bgm-welcome-replay-token") || "";
  if (expected.length < 48 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied, "utf8"), Buffer.from(expected, "utf8"));
}

function sentRecipients(rows: Array<{ after_data: unknown }>) {
  return new Set(rows
    .map(({ after_data }) => {
      const value = after_data && typeof after_data === "object"
        ? (after_data as Record<string, unknown>).recipient : "";
      return String(value || "").trim().toLowerCase();
    })
    .filter(Boolean));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  }
  if (todayMaltaDate() !== REPLAY_DAY) {
    return NextResponse.json({ error: "This incident-only replay window has expired." }, { status: 410, headers: NO_STORE });
  }

  try {
    const db = getSupabaseAdmin();
    const applications = await db.from("bgm_membership_applications")
      .select("id,application_kind,status,activated_at")
      .eq("application_kind", "new")
      .eq("status", "activated")
      .gte("activated_at", START_UTC)
      .lt("activated_at", END_UTC)
      .order("activated_at", { ascending: true });
    if (applications.error) throw applications.error;

    const results: Array<{ applicationId: string; newlySent: number; previouslySent: number; pending: number }> = [];
    for (const app of applications.data || []) {
      // Email is sent using the existing welcome package pipeline. This pipeline
      // checks the sent audit before sending, so already-sent messages are skipped.
      const before = await db.from("bgm_audit_log")
        .select("after_data")
        .eq("entity_type", "membership_application")
        .eq("entity_id", app.id)
        .eq("action_key", SENT_AUDIT_ACTION);
      if (before.error) throw before.error;

      const participants = await db.from("bgm_membership_application_members")
        .select("email")
        .eq("application_id", app.id);
      if (participants.error) throw participants.error;

      const intended = new Set((participants.data || [])
        .map((p) => String(p.email || "").trim().toLowerCase()).filter(Boolean));
      const already = sentRecipients(before.data || []);
      await sendWelcomePackagesBestEffort(app.id);

      const after = await db.from("bgm_audit_log")
        .select("after_data")
        .eq("entity_type", "membership_application")
        .eq("entity_id", app.id)
        .eq("action_key", SENT_AUDIT_ACTION);
      if (after.error) throw after.error;
      const nowSent = sentRecipients(after.data || []);

      results.push({
        applicationId: app.id,
        newlySent: Array.from(intended).filter((recipient) => !already.has(recipient) && nowSent.has(recipient)).length,
        previouslySent: Array.from(intended).filter((recipient) => already.has(recipient)).length,
        pending: Array.from(intended).filter((recipient) => !nowSent.has(recipient)).length,
      });
    }
    return NextResponse.json({
      date: REPLAY_DAY,
      activatedNewApplications: results.length,
      newlySent: results.reduce((n, result) => n + result.newlySent, 0),
      previouslySent: results.reduce((n, result) => n + result.previouslySent, 0),
      pending: results.reduce((n, result) => n + result.pending, 0),
      results,
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Incident-only welcome-email replay failed.", error);
    return NextResponse.json({ error: "Welcome-email replay failed. No membership data was changed." }, { status: 500, headers: NO_STORE });
  }
}
