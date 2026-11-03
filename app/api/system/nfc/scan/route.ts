import { NextRequest, NextResponse } from "next/server";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { evaluateNfcAccess } from "@/lib/nfcAccessCore";
import { todayMaltaDate } from "@/lib/maltaDate";
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
  return todayMaltaDate();
}

function effectiveAccess(member: any, today: string) {
  const pendingIsEffective = Boolean(
    member?.pending_access_scope &&
      member?.pending_access_effective_date &&
      member.pending_access_effective_date <= today,
  );
  const accessScope = pendingIsEffective ? member.pending_access_scope : member?.access_scope;
  const accessGymId = pendingIsEffective ? member.pending_access_gym_id : member?.access_gym_id;
  return {
    accessScope: accessScope || "network",
    accessGymId: accessGymId || (accessScope === "neptunes_only" ? "bgm-neptunes" : null),
  };
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
      return NextResponse.json(
        { error: "NFC card UID is required." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Active gym not found." },
        { status: 404 }
      );
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
        .select(
          "id, member_number, full_name, status, membership_expiry, cancellation_effective_date, access_scope, access_gym_id, pending_access_scope, pending_access_gym_id, pending_access_effective_date, enrollment_gym_id, official_photo_path"
        )
        .eq("id", card.member_id)
        .maybeSingle();
      if (memberResult.error) throw memberResult.error;
      member = memberResult.data;
    }

    const today = todayString();
    const decision = evaluateNfcAccess({
      card: card ? { status: card.status } : null,
      member: member
        ? {
            status: member.status,
            membershipExpiry: member.membership_expiry,
            cancellationEffectiveDate: member.cancellation_effective_date,
            accessScope: member.access_scope,
            accessGymId: member.access_gym_id,
            pendingAccessScope: member.pending_access_scope,
            pendingAccessGymId: member.pending_access_gym_id,
            pendingAccessEffectiveDate: member.pending_access_effective_date,
          }
        : null,
      today,
      gymId,
    });

    let checkinId: string | null = null;
    let duplicate = false;

    if (decision.granted && member) {
      const checkin = await recordCanonicalCheckin({
        memberId: member.id,
        gymId,
        source: "nfc",
      });
      checkinId = checkin.checkinId;
      duplicate = checkin.duplicate;
    }

    const scanResult = await supabase
      .from("bgm_access_scans")
      .insert({
        card_id: card?.id || null,
        card_uid: cardUid,
        credential_type: "nfc",
        credential_value: cardUid,
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

    const effective = effectiveAccess(member, today);
    let accessGymName = "";
    if (effective.accessGymId) {
      const accessGymResult = await supabase
        .from("bgm_gyms")
        .select("name")
        .eq("id", effective.accessGymId)
        .maybeSingle();
      if (!accessGymResult.error) accessGymName = accessGymResult.data?.name || "";
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
            accessScope: effective.accessScope,
            accessGymId: effective.accessGymId,
            accessGymName,
            enrollmentGymId: member.enrollment_gym_id || null,
            enrollmentGymName,
            officialPhotoPath: member.official_photo_path || null,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not process NFC scan." },
      { status: 500 }
    );
  }
}
