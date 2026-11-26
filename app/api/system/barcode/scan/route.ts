import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { scopedConflictCandidates } from "@/lib/scopedCardConflictCandidates";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const MEMBER_SELECT =
  "id, member_number, full_name, status, membership_expiry, cancellation_effective_date, access_scope, access_gym_id, pending_access_scope, pending_access_gym_id, pending_access_effective_date, enrollment_gym_id, official_photo_path, legacy_pk_customer, legacy_gym";

function clean(value: unknown) {
  return String(value ?? "").trim();
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

function accessFor(member: any, gymId?: string | null) {
  return evaluateBarcodeAccess({
    member: {
      status: member.status,
      membershipExpiry: member.membership_expiry,
      cancellationEffectiveDate: member.cancellation_effective_date,
      accessScope: member.access_scope,
      accessGymId: member.access_gym_id,
      pendingAccessScope: member.pending_access_scope,
      pendingAccessGymId: member.pending_access_gym_id,
      pendingAccessEffectiveDate: member.pending_access_effective_date,
    },
    today: todayMaltaDate(),
    gymId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const rawMembershipNumber = clean(body.barcode ?? body.membershipNumber);
    const originalPayload = normalizeBarcodePayload(rawMembershipNumber);
    let scopedCandidates = scopedConflictCandidates(originalPayload);
    // Upper-case only approved exception identifiers; do not touch ordinary scans.
    const membershipNumber = scopedCandidates.length
      ? originalPayload.toUpperCase() : originalPayload;
    const inputSource = ["manual_dialog", "keyboard_prefix", "keyboard_burst", "home_input", "reception_input"].includes(body.inputSource)
      ? String(body.inputSource) : null;
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
    let existingOwnerIds: string[] = [];
    let activeLegacyClaimCount = 0;
    let pendingLegacyIds: string[] = [];
    let blockedLegacyCard = false;
    let legacyResolutionSafe = true;

    if (membershipNumber) {
      const exact = membershipNumber.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      // A current credential wins over every imported claim, even when its
      // member is expired. Reserved/retired credentials also block fallback.
      const cardResult = await supabase.from("bgm_member_card_credentials")
        .select("id, barcode_value, member_id, status, application_member_id")
        .ilike("barcode_value", exact);
      if (cardResult.error) throw cardResult.error;
      const matchingCards = cardResult.data || [];
      const activeCards = matchingCards.filter(row => row.status === "active");
      card = activeCards[0] || matchingCards[0] || null;

      if (card) {
        credentialKind = "physical_card";
        scopedCandidates = [];
        existingOwnerIds = Array.from(new Set(activeCards.map(row => row.member_id).filter(Boolean))) as string[];
        if (existingOwnerIds.length) {
          const owners = await supabase.from("bgm_members").select(MEMBER_SELECT).in("id", existingOwnerIds);
          if (owners.error) throw owners.error;
          if ((owners.data || []).length > 1 || existingOwnerIds.length > 1) {
            cardMatches = owners.data || [];
            ambiguousPhysicalCard = true;
          } else {
            member = owners.data?.[0] || null;
          }
        }
      } else {
        const [claims, pending] = await Promise.all([
          supabase.from("bgm_legacy_card_claims").select("member_id,scan3,assignment_status").ilike("scan3", exact),
          supabase.from("bgm_pending_legacy_card_verifications").select("member_id,status,source_row_number").eq("scan3", membershipNumber.toUpperCase()),
        ]);
        if (claims.error) throw claims.error;
        if (pending.error) throw pending.error;
        const claimRows = claims.data || [];
        const activeClaims = claimRows.filter(row => row.assignment_status === "active");
        const pendingRows = (pending.data || []).filter(row => row.status === "pending");
        if ((pending.data || []).some(row => row.status !== "pending")) scopedCandidates = [];
        const candidateIds = Array.from(new Set([...activeClaims.map(row => row.member_id), ...pendingRows.map(row => row.member_id)]));
        // A member's old card is not usable once a modern card is assigned.
        const currentOwners = candidateIds.length ? await supabase.from("bgm_member_card_credentials")
          .select("member_id").in("member_id", candidateIds).eq("status", "active") : { data: [], error: null };
        if (currentOwners.error) throw currentOwners.error;
        const modernOwnerIds = new Set((currentOwners.data || []).map(row => row.member_id));
        existingOwnerIds = activeClaims.map(row => row.member_id).filter(id => !modernOwnerIds.has(id));
        pendingLegacyIds = pendingRows.map(row => row.member_id).filter(id => !modernOwnerIds.has(id));
        activeLegacyClaimCount = existingOwnerIds.length;
        // The existing RPC compares the complete set of uppercase claims.
        // Do not offer a write for partial or case-variant candidate sets.
        legacyResolutionSafe = candidateIds.every(id => !modernOwnerIds.has(id)) &&
          activeClaims.every(row => row.scan3 === membershipNumber.toUpperCase());
        const eligibleIds = Array.from(new Set([...existingOwnerIds, ...pendingLegacyIds]));
        if (eligibleIds.length) {
          const owners = await supabase.from("bgm_members").select(MEMBER_SELECT).in("id", eligibleIds)
            .neq("status", "archived");
          if (owners.error) throw owners.error;
          const all = owners.data || [];
          legacyResolutionSafe = legacyResolutionSafe && all.length === eligibleIds.length;
          credentialKind = "physical_card";
          if (all.length > 1 || pendingLegacyIds.length > 0) {
            cardMatches = all;
            ambiguousPhysicalCard = true;
          } else if (all.length === 1) member = all[0];
          else blockedLegacyCard = true;
        } else if (claimRows.length || pendingRows.length) {
          // Explicit old/released claims must not re-enter via pkCustomer.
          blockedLegacyCard = true;
          credentialKind = "physical_card";
        } else if (scopedCandidates.length) {
          const scopedResult = await supabase.from("bgm_members").select(MEMBER_SELECT)
            .in("member_number", scopedCandidates).is("archived_at", null);
          if (scopedResult.error) throw scopedResult.error;
          if ((scopedResult.data || []).length) {
            cardMatches = scopedResult.data || [];
            ambiguousPhysicalCard = true;
            credentialKind = "physical_card";
          }
        }
        if (!member && !ambiguousPhysicalCard && !blockedLegacyCard) {
        const memberNumberResult = await supabase
          .from("bgm_members")
          .select(MEMBER_SELECT)
          .ilike("member_number", membershipNumber.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"))
          .limit(2);
        if (memberNumberResult.error) throw memberNumberResult.error;

        if ((memberNumberResult.data || []).length > 1) {
          cardMatches = memberNumberResult.data || [];
          ambiguousPhysicalCard = true;
          credentialKind = "member_number";
        } else if ((memberNumberResult.data || []).length === 1) {
          member = memberNumberResult.data?.[0] || null;
          credentialKind = member ? "member_number" : null;
        } else {
          const legacyResult = await supabase
            .from("bgm_members")
            .select(MEMBER_SELECT)
            .ilike("legacy_pk_customer", membershipNumber.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"))
            .neq("status", "archived")
            .order("full_name", { ascending: true })
            .limit(50);
          if (legacyResult.error) throw legacyResult.error;

          const legacyMembers = legacyResult.data || [];
          const activeLegacyMembers = legacyMembers.filter(
            (candidate) => accessFor(candidate, gymId).granted
          );

          if (legacyMembers.length > 1) {
            cardMatches = legacyMembers;
            ambiguousPhysicalCard = true;
            credentialKind = "legacy_pk_customer";
          } else if (activeLegacyMembers.length === 1) {
            member = activeLegacyMembers[0];
            credentialKind = "legacy_pk_customer";
          } else if (legacyMembers.length === 1) {
            member = legacyMembers[0];
            credentialKind = "legacy_pk_customer";
          }
        }
        }
      }
    }

    let decision: {
      result:
        | "granted"
        | "expired"
        | "inactive"
        | "restricted_gym"
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
    } else if (blockedLegacyCard || (card && card.status !== "active")) {
      decision = { result: "disabled_card", granted: false };
    } else if (!member) {
      decision = { result: "unknown_card", granted: false };
    } else {
      decision = accessFor(member, gymId);
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
        original_credential_value: rawMembershipNumber || null,
        normalized_credential_value: originalPayload.toUpperCase() || null,
        scan_input_source: inputSource,
        lookup_kind: credentialKind,
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

    const today = todayMaltaDate();
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
              id: candidate.id,
              memberNumber: candidate.member_number,
              fullName: candidate.full_name,
              legacyPkCustomer: candidate.legacy_pk_customer,
              status: candidate.status,
              membershipExpiry: candidate.membership_expiry,
              enrollmentGymName: gym?.data?.name || "Not recorded",
              scan3: membershipNumber,
              photoUrl: candidate.official_photo_path
                ? `/api/system/members/photo/${encodeURIComponent(candidate.id)}?inline=1`
                : null,
              isExistingCardOwner: existingOwnerIds.includes(candidate.id),
              isScopedCandidate: scopedCandidates.includes(candidate.member_number),
              canResolveSharedLegacy: legacyResolutionSafe && (activeLegacyClaimCount > 1 || pendingLegacyIds.length > 0) && !card &&
                cardMatches.every(match => existingOwnerIds.includes(match.id) || pendingLegacyIds.includes(match.id)),
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
            accessScope: effective.accessScope,
            accessGymId: effective.accessGymId,
            accessGymName,
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
