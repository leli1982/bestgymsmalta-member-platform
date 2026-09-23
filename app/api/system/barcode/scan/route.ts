import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { resolveLegacyPkCustomerCandidates } from "@/lib/legacyPkCustomerResolution";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const MEMBER_SELECT =
  "id, member_number, full_name, status, membership_expiry, cancellation_effective_date, enrollment_gym_id, official_photo_path, legacy_pk_customer";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function accessFor(member: any) {
  return evaluateBarcodeAccess({
    member: {
      status: member.status,
      membershipExpiry: member.membership_expiry,
      cancellationEffectiveDate: member.cancellation_effective_date,
    },
    today: todayMaltaDate(),
  });
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
    let credentialKind:
      | "physical_card"
      | "member_number"
      | "legacy_pk_customer"
      | null = null;
    let legacyMatches: any[] = [];
    let ambiguousLegacyCard = false;

    if (membershipNumber) {
      const cardResult = await supabase
        .from("bgm_member_card_credentials")
        .select("id, barcode_value, member_id, status")
        .eq("barcode_value", membershipNumber)
        .maybeSingle();
      if (cardResult.error) throw cardResult.error;
      card = cardResult.data;
      if (card) credentialKind = "physical_card";

      if (card?.member_id) {
        const memberResult = await supabase
          .from("bgm_members")
          .select(MEMBER_SELECT)
          .eq("id", card.member_id)
          .maybeSingle();
        if (memberResult.error) throw memberResult.error;
        member = memberResult.data;
      } else if (!card) {
        const memberNumberResult = await supabase
          .from("bgm_members")
          .select(MEMBER_SELECT)
          .eq("member_number", membershipNumber)
          .limit(2);
        if (memberNumberResult.error) throw memberNumberResult.error;

        if ((memberNumberResult.data || []).length === 1) {
          member = memberNumberResult.data?.[0] || null;
          credentialKind = member ? "member_number" : null;
        } else if ((memberNumberResult.data || []).length === 0) {
          // The legacy system used pkCustomer as the printed/scanned membership
          // number. Duplicate historical values are legitimate records, so never
          // discard them. Ignore inactive duplicates when exactly one live member
          // remains; if multiple live members share the number, do not guess.
          const legacyResult = await supabase
            .from("bgm_members")
            .select(MEMBER_SELECT)
            .eq("legacy_pk_customer", membershipNumber)
            .limit(50);
          if (legacyResult.error) throw legacyResult.error;

          legacyMatches = legacyResult.data || [];
          const legacyResolution = resolveLegacyPkCustomerCandidates(
            legacyMatches,
            todayMaltaDate()
          );

          if (legacyResolution.kind === "resolved") {
            member = legacyResolution.member;
            credentialKind = "legacy_pk_customer";
          } else if (legacyResolution.kind === "ambiguous") {
            ambiguousLegacyCard = true;
            legacyMatches = legacyResolution.liveMatches;
            credentialKind = "legacy_pk_customer";
          }
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
        | "ambiguous_card";
      granted: boolean;
    };

    const hasPhoto = Boolean(member?.official_photo_path);
    const photoRequired = Boolean(member && !hasPhoto);

    if (!membershipNumber) {
      decision = { result: "invalid_barcode", granted: false };
    } else if (card && card.status !== "active") {
      decision = { result: "disabled_card", granted: false };
    } else if (ambiguousLegacyCard) {
      decision = { result: "ambiguous_card", granted: false };
    } else if (!member && legacyMatches.length > 1) {
      // More than one historical row exists but none is currently live.
      // The old number is known, but access is not granted.
      decision = { result: "inactive", granted: false };
    } else if (!member) {
      decision = { result: "unknown_card", granted: false };
    } else {
      const membershipDecision = accessFor(member);
      decision = membershipDecision;
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

    const credentialValue =
      membershipNumber || rawMembershipNumber || "(blank)";
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
        photo_required_warning: photoRequired,
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
      scannedBarcode: membershipNumber || rawMembershipNumber,
      credentialKind,
      cardStatus:
        credentialKind === "physical_card"
          ? card?.status || null
          : credentialKind === "member_number"
            ? "member_number"
            : credentialKind === "legacy_pk_customer"
              ? "legacy_pk_customer"
              : null,
      legacyMatches: ambiguousLegacyCard
        ? legacyMatches.map((candidate) => ({
              id: candidate.id,
              memberNumber: candidate.member_number,
              fullName: candidate.full_name,
              status: candidate.status,
              membershipExpiry: candidate.membership_expiry,
            }))
        : [],
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
