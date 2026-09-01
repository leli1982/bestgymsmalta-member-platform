import { NextRequest, NextResponse } from "next/server";
import { evaluateNfcAccess } from "@/lib/nfcAccessCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeCardUid(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

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
  const payload = {
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
    const result = await supabase
      .from("bgm_member_stats")
      .update(payload)
      .eq("id", existingResult.data.id);
    if (result.error) throw result.error;
  } else {
    const result = await supabase.from("bgm_member_stats").insert(payload);
    if (result.error) throw result.error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "nfc.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const cardUid = normalizeCardUid(body.cardUid);
    const deviceId = clean(body.deviceId);
    const requestedGymId = clean(body.gymId);
    const gymId = auth.context.gymId || requestedGymId;

    if (!cardUid) {
      return NextResponse.json({ error: "NFC card UID is required." }, { status: 400 });
    }

    if (!gymId) {
      return NextResponse.json(
        { error: "A gym must be selected before scanning." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id, name, status")
      .eq("id", gymId)
      .maybeSingle();

    if (gymResult.error) throw gymResult.error;
    if (!gymResult.data || gymResult.data.status !== "active") {
      return NextResponse.json({ error: "Active gym not found." }, { status: 404 });
    }

    const cardResult = await supabase
      .from("bgm_nfc_cards")
      .select("id, card_uid, member_id, status")
      .ilike("card_uid", cardUid)
      .maybeSingle();

    if (cardResult.error) throw cardResult.error;
    const card = cardResult.data;

    let member: any = null;
    if (card?.member_id) {
      const memberResult = await supabase
        .from("bgm_members")
        .select("id, member_number, full_name, status, membership_expiry, enrollment_gym_id, official_photo_path")
        .eq("id", card.member_id)
        .maybeSingle();
      if (memberResult.error) throw memberResult.error;
      member = memberResult.data;
    }

    const decision = evaluateNfcAccess({
      card: card ? { status: card.status } : null,
      member: member
        ? {
            status: member.status,
            membershipExpiry: member.membership_expiry,
          }
        : null,
      today: todayString(),
    });

    let checkinId: string | null = null;
    let duplicate = false;

    if (decision.granted && member) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const recentResult = await supabase
        .from("bgm_member_checkins")
        .select("id, checkin_at")
        .eq("member_id", member.id)
        .eq("gym_id", gymId)
        .gte("checkin_at", twoHoursAgo)
        .order("checkin_at", { ascending: false })
        .limit(1);

      if (recentResult.error) throw recentResult.error;

      if ((recentResult.data || []).length > 0) {
        duplicate = true;
        checkinId = recentResult.data?.[0]?.id || null;
      } else {
        const insertResult = await supabase
          .from("bgm_member_checkins")
          .insert({ member_id: member.id, gym_id: gymId, source: "nfc" })
          .select("id")
          .single();
        if (insertResult.error) throw insertResult.error;
        checkinId = insertResult.data.id;
      }

      await refreshMemberStats(member.id);
    }

    const scanResult = await supabase
      .from("bgm_access_scans")
      .insert({
        card_id: card?.id || null,
        card_uid: cardUid,
        member_id: member?.id || null,
        gym_id: gymId,
        system_user_id: auth.context.systemUserId,
        device_id: deviceId || null,
        result: decision.result,
        membership_expiry_snapshot: member?.membership_expiry || null,
        checkin_id: checkinId,
      })
      .select("id, scanned_at")
      .single();

    if (scanResult.error) throw scanResult.error;

    let enrollmentGymName = "";
    if (member?.enrollment_gym_id) {
      const enrollmentGymResult = await supabase
        .from("bgm_gyms")
        .select("name")
        .eq("id", member.enrollment_gym_id)
        .maybeSingle();
      if (!enrollmentGymResult.error) {
        enrollmentGymName = enrollmentGymResult.data?.name || "";
      }
    }

    return NextResponse.json({
      result: decision.result,
      granted: decision.granted,
      duplicate,
      scanId: scanResult.data.id,
      scannedAt: scanResult.data.scanned_at,
      gym: { id: gymResult.data.id, name: gymResult.data.name },
      member: member
        ? {
            id: member.id,
            memberNumber: member.member_number,
            fullName: member.full_name,
            status: member.status,
            membershipExpiry: member.membership_expiry,
            enrollmentGymId: member.enrollment_gym_id || null,
            enrollmentGymName,
            officialPhotoPath: member.official_photo_path || null,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not process NFC scan." }, { status: 500 });
  }
}
