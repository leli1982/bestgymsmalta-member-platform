import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const rawMembershipNumber = clean(body.barcode ?? body.membershipNumber);
    const membershipNumber = normalizeBarcodePayload(rawMembershipNumber);
    const deviceId = clean(body.deviceId);
    const requestedGymId = clean(body.gymId);
    const gymId = auth.context.gymId || requestedGymId;

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

    let member: any = null;
    let card: any = null;

    if (membershipNumber) {
      const cardResult = await supabase
        .from("bgm_member_card_credentials")
        .select("id, barcode_value, member_id, status")
        .eq("barcode_value", membershipNumber)
        .maybeSingle();
      if (cardResult.error) throw cardResult.error;
      card = cardResult.data;

      if (card?.member_id) {
        const memberResult = await supabase
          .from("bgm_members")
          .select(
            "id, member_number, full_name, status, membership_expiry, enrollment_gym_id, official_photo_path"
          )
          .eq("id", card.member_id)
          .maybeSingle();
        if (memberResult.error) throw memberResult.error;
        member = memberResult.data;
      } else if (!card) {
        // Transitional fallback for migrated members whose current issued card is
        // still mirrored only in member_number. Never guess if the mirror is ambiguous.
        const compatibilityResult = await supabase
          .from("bgm_members")
          .select(
            "id, member_number, full_name, status, membership_expiry, enrollment_gym_id, official_photo_path"
          )
          .eq("member_number", membershipNumber)
          .limit(2);
        if (compatibilityResult.error) throw compatibilityResult.error;
        if ((compatibilityResult.data || []).length === 1) {
          member = compatibilityResult.data?.[0] || null;
        }
      }
    }

    let decision: {
      result:
        | "granted"
        | "expired"
        | "inactive"
        | "unknown_member"
        | "unknown_card"
        | "disabled_card"
        | "invalid_barcode"
        | "photo_required";
      granted: boolean;
    };

    if (!membershipNumber) {
      decision = { result: "invalid_barcode", granted: false };
    } else if (card && card.status !== "active") {
      decision = { result: "disabled_card", granted: false };
    } else if (!member) {
      decision = { result: "unknown_card", granted: false };
    } else {
      const membershipDecision = evaluateBarcodeAccess({
        member: {
          status: member.status,
          membershipExpiry: member.membership_expiry,
        },
        today: todayString(),
      });

      if (membershipDecision.granted && !member.official_photo_path) {
        decision = { result: "photo_required", granted: false };
      } else {
        decision = membershipDecision;
      }
    }

    let checkinId: string | null = null;
    let duplicate = false;

    if (decision.granted && member) {
      const checkin = await recordCanonicalCheckin({
        memberId: member.id,
        gymId,
        source: "barcode",
      });
      checkinId = checkin.checkinId;
      duplicate = checkin.duplicate;
    }

    const credentialValue = membershipNumber || rawMembershipNumber || "(blank)";
    const scanResult = await supabase
      .from("bgm_access_scans")
      .insert({
        card_id: null,
        card_uid: null,
        credential_type: "barcode",
        credential_value: membershipNumber || credentialValue,
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

    const hasPhoto = Boolean(member?.official_photo_path);

    return NextResponse.json({
      result: decision.result,
      granted: decision.granted,
      duplicate,
      scanId: scanResult.data.id,
      scannedAt: scanResult.data.scanned_at,
      scannedBarcode: membershipNumber || rawMembershipNumber,
      cardStatus: card?.status || (member ? "legacy" : null),
      gym: { id: gymResult.data.id, name: gymResult.data.name },
      member: member
        ? {
            id: member.id,
            memberNumber: member.member_number || membershipNumber,
            fullName: member.full_name,
            status: member.status,
            membershipExpiry: member.membership_expiry,
            enrollmentGymId: member.enrollment_gym_id || null,
            enrollmentGymName,
            hasPhoto,
            photoRequired: !hasPhoto,
            photoUrl: hasPhoto
              ? `/api/system/members/photo/${encodeURIComponent(member.id)}`
              : null,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not process barcode scan." },
      { status: 500 }
    );
  }
}
