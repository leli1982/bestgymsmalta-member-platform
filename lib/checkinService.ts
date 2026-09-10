import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type CheckinSource = "qr" | "nfc" | "barcode";

async function refreshMemberStats(memberId: string) {
  const supabase = getSupabaseAdmin();

  const checkinsResult = await supabase
    .from("bgm_member_checkins")
    .select("gym_id, checkin_at")
    .eq("member_id", memberId)
    .order("checkin_at", { ascending: false });

  if (checkinsResult.error) throw checkinsResult.error;

  const checkins = checkinsResult.data || [];
  const passportStamps = new Set(checkins.map((item) => item.gym_id)).size;
  const stats = {
    member_id: memberId,
    workouts_completed: checkins.length,
    current_streak: 0,
    passport_stamps: passportStamps,
    last_checkin_at: checkins[0]?.checkin_at || null,
    updated_at: new Date().toISOString(),
  };

  const existingResult = await supabase
    .from("bgm_member_stats")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;

  if (existingResult.data?.id) {
    const updateResult = await supabase
      .from("bgm_member_stats")
      .update(stats)
      .eq("id", existingResult.data.id);

    if (updateResult.error) throw updateResult.error;
  } else {
    const insertResult = await supabase.from("bgm_member_stats").insert(stats);
    if (insertResult.error) throw insertResult.error;
  }

  return stats;
}

export async function recordCanonicalCheckin({
  memberId,
  gymId,
  source,
}: {
  memberId: string;
  gymId: string;
  source: CheckinSource;
}) {
  const supabase = getSupabaseAdmin();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const recentResult = await supabase
    .from("bgm_member_checkins")
    .select("id, checkin_at")
    .eq("member_id", memberId)
    .eq("gym_id", gymId)
    .gte("checkin_at", twoHoursAgo)
    .order("checkin_at", { ascending: false })
    .limit(1);

  if (recentResult.error) throw recentResult.error;

  const recent = recentResult.data?.[0] || null;
  if (recent) {
    const stats = await refreshMemberStats(memberId);
    return {
      duplicate: true,
      checkinId: recent.id || null,
      checkin: null,
      stats,
    };
  }

  const insertResult = await supabase
    .from("bgm_member_checkins")
    .insert({
      member_id: memberId,
      gym_id: gymId,
      source,
    })
    .select()
    .single();

  if (insertResult.error) throw insertResult.error;

  const stats = await refreshMemberStats(memberId);

  return {
    duplicate: false,
    checkinId: insertResult.data.id || null,
    checkin: insertResult.data,
    stats,
  };
}
