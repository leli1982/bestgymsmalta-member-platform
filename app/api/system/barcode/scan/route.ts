import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import {
  normalizeMembershipNumber,
  parseMembershipNumber,
} from "@/lib/memberNumberCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const rawMembershipNumber = clean(body.membershipNumber);
    const membershipNumber = normalizeMembershipNumber(rawMembershipNumber);
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

    const validBarcode = parseMembershipNumber(membershipNumber) !== null;
    let member: any = null;

    if (validBarcode) {
      const memberResult = await supabase
        .from("bgm_members")
        .select(
          "id, member_number, full_name, status, membership_expiry, enrollment_gym_id, official_photo_path"
        )
        .eq("member_number", membershipNumber)
        .maybeSingle();

      if (memberResult.error) throw memberResult.error;
      member = memberResult.data;
    }

    const decision = validBarcode
      ? evaluateBarcodeAccess({
          member: member
            ? {
                status: member.status,
                membershipExpiry: member.membership_expiry,
              }
            : null,
          today: todayString(),
        })
      : { result: "invalid_barcode" as const, granted: false };

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
        credential_value: membershipNumber,
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

    if (scanResult.error) {
      // Keep a non-empty value available for malformed/blank input while retaining
      // the exact normalized membership number for valid barcode scans.
      if (!membershipNumber) {
        const fallbackScan = await supabase
          .from("bgm_access_scans")
          .insert({
            card_id: null,
            card_uid: null,
            credential_type: "barcode",
            credential_value: credentialValue,
            member_id: null,
            gym_id: gymId,
            system_user_id: auth.context.systemUserId,
            device_id: deviceId || null,
            result: decision.result,
            membership_expiry_snapshot: null,
            checkin_id: null,
          })
          .select("id, scanned_at")
          .single();
        if (fallbackScan.error) throw fallbackScan.error;
        return NextResponse.json({
          result: decision.result,
          granted: false,
          duplicate: false,
          scanId: fallbackScan.data.id,
          scannedAt: fallbackScan.data.scanned_at,
          gym: { id: gymResult.data.id, name: gymResult.data.name },
          member: null,
        });
      }
      throw scanResult.error;
    }

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
    return NextResponse.json(
      { error: "Could not process barcode scan." },
      { status: 500 }
    );
  }
}
