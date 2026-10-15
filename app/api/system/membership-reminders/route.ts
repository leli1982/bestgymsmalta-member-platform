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
    const [settingsResult, recentResult, sentCount, skippedCount, failedCount] = await Promise.all([
      supabase
        .from("bgm_membership_reminder_settings")
        .select("enabled,email_enabled,push_enabled,day_1_enabled,day_7_enabled,day_14_enabled,day_21_enabled,day_30_enabled,updated_at")
        .eq("id", "membership_expiry")
        .maybeSingle(),
      supabase
        .from("bgm_membership_reminder_log")
        .select("id,member_id,membership_expiry,days_before,channel,status,reason,error_text,attempted_at,sent_at")
        .order("attempted_at", { ascending: false })
        .limit(30),
      supabase.from("bgm_membership_reminder_log").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("bgm_membership_reminder_log").select("id", { count: "exact", head: true }).eq("status", "skipped"),
      supabase.from("bgm_membership_reminder_log").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    for (const result of [settingsResult, recentResult, sentCount, skippedCount, failedCount]) {
      if (result.error) throw result.error;
    }

    const memberIds = Array.from(
      new Set((recentResult.data || []).map((row) => row.member_id).filter(Boolean))
    );
    const membersResult = memberIds.length
      ? await supabase.from("bgm_members").select("id,member_number,full_name").in("id", memberIds)
      : { data: [], error: null };
    if (membersResult.error) throw membersResult.error;
    const members = new Map((membersResult.data || []).map((member) => [member.id, member]));

    const row = settingsResult.data || {
      enabled: true,
      email_enabled: true,
      push_enabled: true,
      day_1_enabled: true,
      day_7_enabled: true,
      day_14_enabled: true,
      day_21_enabled: true,
      day_30_enabled: true,
      updated_at: null,
    };

    return NextResponse.json({
      settings: {
        enabled: Boolean(row.enabled),
        emailEnabled: Boolean(row.email_enabled),
        pushEnabled: Boolean(row.push_enabled),
        day1Enabled: Boolean(row.day_1_enabled),
        day7Enabled: Boolean(row.day_7_enabled),
        day14Enabled: Boolean(row.day_14_enabled),
        day21Enabled: Boolean(row.day_21_enabled),
        day30Enabled: Boolean(row.day_30_enabled),
        updatedAt: row.updated_at,
      },
      totals: {
        sent: sentCount.count || 0,
        skipped: skippedCount.count || 0,
        failed: failedCount.count || 0,
      },
      recent: (recentResult.data || []).map((item) => {
        const member = members.get(item.member_id);
        return {
          ...item,
          memberNumber: member?.member_number || "",
          memberName: member?.full_name || "",
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load membership reminder settings." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    let settings;
    try {
      settings = {
        enabled: bool(body.enabled, "Master reminder setting"),
        emailEnabled: bool(body.emailEnabled, "Email reminders"),
        pushEnabled: bool(body.pushEnabled, "App reminders"),
        day1Enabled: bool(body.day1Enabled, "1 day reminder"),
        day7Enabled: bool(body.day7Enabled, "1 week reminder"),
        day14Enabled: bool(body.day14Enabled, "2 week reminder"),
        day21Enabled: bool(body.day21Enabled, "3 week reminder"),
        day30Enabled: bool(body.day30Enabled, "1 month reminder"),
      };

      if (settings.enabled && !settings.emailEnabled && !settings.pushEnabled) {
        throw new Error("Enable Email reminders, App notifications, or both.");
      }
      if (
        settings.enabled &&
        !settings.day1Enabled &&
        !settings.day7Enabled &&
        !settings.day14Enabled &&
        !settings.day21Enabled &&
        !settings.day30Enabled
      ) {
        throw new Error("Choose at least one reminder timing.");
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid reminder settings." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const beforeResult = await supabase
      .from("bgm_membership_reminder_settings")
      .select("*")
      .eq("id", "membership_expiry")
      .maybeSingle();
    if (beforeResult.error) throw beforeResult.error;

    const now = new Date().toISOString();
    const result = await supabase
      .from("bgm_membership_reminder_settings")
      .upsert({
        id: "membership_expiry",
        enabled: settings.enabled,
        email_enabled: settings.emailEnabled,
        push_enabled: settings.pushEnabled,
        day_1_enabled: settings.day1Enabled,
        day_7_enabled: settings.day7Enabled,
        day_14_enabled: settings.day14Enabled,
        day_21_enabled: settings.day21Enabled,
        day_30_enabled: settings.day30Enabled,
        updated_by_system_user_id: auth.context.systemUserId,
        updated_at: now,
      }, { onConflict: "id" })
      .select("enabled,email_enabled,push_enabled,day_1_enabled,day_7_enabled,day_14_enabled,day_21_enabled,day_30_enabled,updated_at")
      .single();
    if (result.error) throw result.error;

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: auth.context.gymId,
      staff_name: null,
      action_key: "membership_reminders.settings_updated",
      entity_type: "membership_reminder_settings",
      entity_id: "membership_expiry",
      before_data: beforeResult.data,
      after_data: result.data,
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({
      settings: {
        enabled: Boolean(result.data.enabled),
        emailEnabled: Boolean(result.data.email_enabled),
        pushEnabled: Boolean(result.data.push_enabled),
        day1Enabled: Boolean(result.data.day_1_enabled),
        day7Enabled: Boolean(result.data.day_7_enabled),
        day14Enabled: Boolean(result.data.day_14_enabled),
        day21Enabled: Boolean(result.data.day_21_enabled),
        day30Enabled: Boolean(result.data.day_30_enabled),
        updatedAt: result.data.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update membership reminder settings." }, { status: 500 });
  }
}
