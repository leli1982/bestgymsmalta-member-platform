import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function bool(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new Error(`${label} must be true or false.`);
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_member_engagement_settings")
      .select("enabled,inactivity_enabled,streak_enabled,updated_at")
      .eq("id", "member_engagement")
      .maybeSingle();
    if (result.error) throw result.error;

    const row = result.data;
    return NextResponse.json({
      settings: {
        enabled: row?.enabled ?? false,
        inactivityEnabled: row?.inactivity_enabled ?? true,
        streakEnabled: row?.streak_enabled ?? true,
        updatedAt: row?.updated_at ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load member engagement settings." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    let settings: { enabled: boolean; inactivityEnabled: boolean; streakEnabled: boolean };
    try {
      settings = {
        enabled: bool(body.enabled, "Global engagement notifications"),
        inactivityEnabled: bool(body.inactivityEnabled, "Inactivity notifications"),
        streakEnabled: bool(body.streakEnabled, "Streak notifications"),
      };
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid engagement settings." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const beforeResult = await supabase
      .from("bgm_member_engagement_settings")
      .select("*")
      .eq("id", "member_engagement")
      .maybeSingle();
    if (beforeResult.error) throw beforeResult.error;

    const now = new Date().toISOString();
    const result = await supabase
      .from("bgm_member_engagement_settings")
      .upsert({
        id: "member_engagement",
        enabled: settings.enabled,
        inactivity_enabled: settings.inactivityEnabled,
        streak_enabled: settings.streakEnabled,
        updated_by_system_user_id: auth.context.systemUserId,
        updated_at: now,
      }, { onConflict: "id" })
      .select("enabled,inactivity_enabled,streak_enabled,updated_at")
      .single();
    if (result.error) throw result.error;

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: auth.context.gymId,
      staff_name: null,
      action_key: "member_engagement.settings_updated",
      entity_type: "member_engagement_settings",
      entity_id: "member_engagement",
      before_data: beforeResult.data,
      after_data: result.data,
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({
      settings: {
        enabled: Boolean(result.data.enabled),
        inactivityEnabled: Boolean(result.data.inactivity_enabled),
        streakEnabled: Boolean(result.data.streak_enabled),
        updatedAt: result.data.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update member engagement settings." }, { status: 500 });
  }
}
