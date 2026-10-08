import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function requireMemberSession(request: NextRequest) {
  const session = await getMemberRequestSession(request);
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Member session required." }, { status: 401 }) };
  }
  return { session, error: null };
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${label} must be true or false.`);
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMemberSession(request);
    if (!auth.session) return auth.error;
    const session = auth.session;

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_member_notification_preferences")
      .select("critical_enabled,motivational_enabled,updated_at")
      .eq("member_id", session.memberId)
      .maybeSingle();
    if (result.error) throw result.error;

    const row = result.data;
    return NextResponse.json({
      preferences: {
        criticalEnabled: row?.critical_enabled ?? true,
        motivationalEnabled: row?.motivational_enabled ?? true,
        updatedAt: row?.updated_at ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load notification preferences." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMemberSession(request);
    if (!auth.session) return auth.error;
    const session = auth.session;

    const body = await request.json();
    let criticalEnabled: boolean | undefined;
    let motivationalEnabled: boolean | undefined;
    try {
      criticalEnabled = optionalBoolean(body.criticalEnabled, "Membership & account reminders");
      motivationalEnabled = optionalBoolean(body.motivationalEnabled, "Motivation & streaks");
      if (criticalEnabled === undefined && motivationalEnabled === undefined) {
        throw new Error("Choose at least one notification preference to update.");
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid notification preferences." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const currentResult = await supabase
      .from("bgm_member_notification_preferences")
      .select("critical_enabled,motivational_enabled")
      .eq("member_id", session.memberId)
      .maybeSingle();
    if (currentResult.error) throw currentResult.error;

    const now = new Date().toISOString();
    const result = await supabase
      .from("bgm_member_notification_preferences")
      .upsert({
        member_id: session.memberId,
        critical_enabled: criticalEnabled ?? currentResult.data?.critical_enabled ?? true,
        motivational_enabled: motivationalEnabled ?? currentResult.data?.motivational_enabled ?? true,
        updated_at: now,
      }, { onConflict: "member_id" })
      .select("critical_enabled,motivational_enabled,updated_at")
      .single();
    if (result.error) throw result.error;

    return NextResponse.json({
      preferences: {
        criticalEnabled: Boolean(result.data.critical_enabled),
        motivationalEnabled: Boolean(result.data.motivational_enabled),
        updatedAt: result.data.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update notification preferences." }, { status: 500 });
  }
}
