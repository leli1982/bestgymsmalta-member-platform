import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const MEMBER_SELECT =
  "id, member_number, full_name, status, membership_expiry, cancellation_effective_date, enrollment_gym_id, official_photo_path, legacy_pk_customer, legacy_gym";

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
    let cardMatches: any[] = [];
    let ambiguousPhysicalCard = false;
    let activeLegacyClaimCount = 0;

    if (membershipNumber) {
      const claimsResult = await supabase.from("bgm_legacy_card_claims")
        .select("member_id").eq("scan3", membershipNumber.toUpperCase()).eq("assignment_status", "active");
      if (claimsResult.error) throw claimsResult.error;
      activeLegacyClaimCount = (claimsResult.data || []).length;
      const cardResult = await supabase
        .from("bgm_member_card_credentials")
        .select("id, barcode_value, member_id, status")
        .eq("barcode_value", membershipNumber)
        .maybeSingle();
      if (cardResult.error) throw cardResult.error;
      card = cardResult.data;
      if (card) credentialKind = "physical_card";

      const claimIds = (claimsResult.data || []).map((claim) => claim.member_id);
      if (card?.status === "active" && card.member_id) claimIds.push(card.member_id);
      if (claimIds.length) {
        const claimedResult = await supabase.from("bgm_members").select(MEMBER_SELECT)
          .in("id", Array.from(new Set(claimIds)));
        if (claimedResult.error) throw claimedResult.error;
        const allClaims = claimedResult.data || [];
        const activeClaims = allClaims.filter((candidate) => accessFor(candidate).granted);
        credentialKind = "physical_card";

        // A shared historical/physical card must never collapse to "not found".
        // If more than one member owns the scanned value, show every match so
        // reception can identify the person and flag the conflict to admin,
        // regardless of whether the memberships are active or expired.
        if (allClaims.length > 1) {
          cardMatches = allClaims;
          ambiguousPhysicalCard = true;
        } else if (activeClaims.length === 1) {
          member = activeClaims[0];
        } else if (allClaims.length === 1) {
          member = allClaims[0];
        }
      }

      if (!claimIds.length && card?.member_id) {
        const memberResult = await supabase
          .from("bgm_members")
          .select(MEMBER_SELECT)
          .eq("id", card.member_id)
          .maybeSingle();
        if (memberResult.error) throw memberResult.error;
        member = memberResult.data;
      } else if (!claimIds.length && !card) {
        const memberNumberResult = await supabase
          .from("bgm_members")
          .select(MEMBER_SELECT)
          .eq("member_number", membershipNumber)
          .limit(2);
        if (memberNumberResult.error) throw memberNumberResult.error;

        if ((memberNumberResult.data || []).length === 1) {
          member = memberNumberResult.data?.[0] || null;
          credentialKind = member ? "member_number" : null;
        } else {
          const legacyResult = await supabase
            .from("bgm_members")
            .select(MEMBER_SELECT)
            .eq("legacy_pk_customer", membershipNumber)
            .neq("status", "archived")
            .order("full_name", { ascending: true })
            .limit(50);
          if (legacyResult.error) throw legacyResult.error;

          const legacyMembers = legacyResult.data || [];
          const activeLegacyMembers = legacyMembers.filter(
            (candidate) => accessFor(candidate).granted
          );

          if (activeLegacyMembers.length > 1) {
            cardMatches = activeLegacyMembers;
            ambiguousPhysicalCard = true;
            credentialKind = "legacy_pk_customer";
          } else if (activeLegacyMembers.length === 1) {
            member = activeLegacyMembers[0];
            credentialKind = "legacy_pk_customer";
          } else if (legacyMembers.length === 1) {
            member = legacyMembers[0];
            credentialKind = "legacy_pk_customer";
          } else if (legacyMembers.length > 1) {
            cardMatches = legacyMembers;
            ambiguousPhysicalCard = true;
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
    } else if (ambiguousPhysicalCard) {
      decision = { result: "ambiguous_card", granted: false };
    } else if (card && card.status !== "active" && activeLegacyClaimCount === 0) {
      // A retired/replaced modern physical card must never grant entry merely
      // because its historical credential still points at the member.
      decision = { result: "disabled_card", granted: false };
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

    let currentPhysicalCard: string | null = null;
    let currentPhysicalCardSource: "credential" | "legacy_scan3" | null = null;
    if (member) {
      const [activeCardResult, legacyClaimResult] = await Promise.all([
        supabase.from("bgm_member_card_credentials")
          .select("barcode_value,updated_at")
          .eq("member_id", member.id)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.from("bgm_legacy_card_claims")
          .select("scan3,updated_at")
          .eq("member_id", member.id)
          .eq("assignment_status", "active")
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      if (activeCardResult.error) throw activeCardResult.error;
      if (legacyClaimResult.error) throw legacyClaimResult.error;
      if (activeCardResult.data?.[0]?.barcode_value) {
        currentPhysicalCard = activeCardResult.data[0].barcode_value;
        currentPhysicalCardSource = "credential";
      } else if (legacyClaimResult.data?.[0]?.scan3) {
        currentPhysicalCard = legacyClaimResult.data[0].scan3;
        currentPhysicalCardSource = "legacy_scan3";
      }
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
      scannedBarcode: membershipNumber || rawMembershipNumber,
      credentialKind,
      currentPhysicalCard,
      currentPhysicalCardSource,
      cardStatus:
        credentialKind === "physical_card"
          ? card?.status || null
          : credentialKind === "member_number"
            ? "member_number"
            : null,
      cardMatches: ambiguousPhysicalCard
        ? await Promise.all(cardMatches.map(async (candidate) => {
            const gym = candidate.enrollment_gym_id
              ? await supabase.from("bgm_gyms").select("name")
                .eq("id", candidate.enrollment_gym_id).maybeSingle()
              : null;
            return {
              id: candidate.id, memberNumber: candidate.member_number,
              fullName: candidate.full_name, legacyPkCustomer: candidate.legacy_pk_customer,
              status: candidate.status, membershipExpiry: candidate.membership_expiry,
              enrollmentGymName: gym?.data?.name || "Not recorded",
              scan3: membershipNumber,
              photoUrl: candidate.official_photo_path
                ? `/api/system/members/photo/${encodeURIComponent(candidate.id)}?inline=1`
                : null,
            };
          }))
        : [],
      legacyMatches: [],
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
            legacyGym: member.legacy_gym || null,
            hasPhoto,
            photoRequired: !hasPhoto,
            photoUrl: hasPhoto
              ? `/api/system/members/photo/${encodeURIComponent(member.id)}?inline=1`
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
