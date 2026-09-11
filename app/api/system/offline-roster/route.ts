import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  hashOfflineRoster,
  toOfflineRosterMember,
} from "@/lib/offlineRosterCore";

export const dynamic = "force-dynamic";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "offline_roster.view");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("member_number, full_name")
      .eq("status", "active")
      .or(`membership_expiry.is.null,membership_expiry.gte.${todayString()}`)
      .order("member_number", { ascending: true });

    if (memberResult.error) throw memberResult.error;

    const members = (memberResult.data || [])
      .map(toOfflineRosterMember)
      .filter((member) => member.memberNumber && member.fullName);
    const rosterHash = hashOfflineRoster(members);
    const generatedAt = new Date().toISOString();
    const deviceId = String(request.nextUrl.searchParams.get("deviceId") || "").trim();

    if (deviceId && auth.context.gymId) {
      const syncResult = await supabase.from("bgm_offline_roster_syncs").upsert(
        {
          system_user_id: auth.context.systemUserId,
          gym_id: auth.context.gymId,
          device_id: deviceId,
          last_synced_at: generatedAt,
          member_count: members.length,
          roster_hash: rosterHash,
          updated_at: generatedAt,
        },
        { onConflict: "system_user_id,device_id" }
      );

      if (syncResult.error) throw syncResult.error;
    }

    return NextResponse.json({
      generatedAt,
      memberCount: members.length,
      rosterHash,
      members,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not build the offline member roster." },
      { status: 500 }
    );
  }
}
