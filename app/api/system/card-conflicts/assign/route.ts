import { NextRequest, NextResponse } from "next/server";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { recordCanonicalCheckin } from "@/lib/checkinService";
import { todayMaltaDate } from "@/lib/maltaDate";
import { scopedConflictCandidates } from "@/lib/scopedCardConflictCandidates";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Staff verification for scoped exceptions and current shared legacy claims.
 * Modern and NFC credentials are never transferred by this route.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json().catch(() => ({}));
    const scanId = clean(body.scanId);
    const memberId = clean(body.memberId);
    if (!scanId || !memberId || body.confirmed !== true) {
      return NextResponse.json({ error: "Scan, selected member and identity confirmation are required." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const scanResult = await db.from("bgm_access_scans")
      .select("id,credential_value,credential_type,gym_id,system_user_id,result,scanned_at")
      .eq("id", scanId).maybeSingle();
    if (scanResult.error) throw scanResult.error;
    const scan = scanResult.data;
    if (!scan || scan.result !== "ambiguous_card" || scan.credential_type !== "barcode") {
      return NextResponse.json({ error: "The conflict scan is no longer available. Scan the card again." }, { status: 409 });
    }
    if (scan.system_user_id !== auth.context.systemUserId ||
        (auth.context.gymId && scan.gym_id !== auth.context.gymId) ||
        (auth.context.role === "gym_manager" && !auth.context.managedGymIds.includes(scan.gym_id))) {
      return NextResponse.json({ error: "This scan belongs to another staff session or gym." }, { status: 403 });
    }
    const age = Date.now() - new Date(scan.scanned_at).getTime();
    if (!Number.isFinite(age) || age < -30_000 || age > 10 * 60_000) {
      return NextResponse.json({ error: "Conflict selection expired. Please scan the card again." }, { status: 409 });
    }

    const code = clean(scan.credential_value).toUpperCase();
    const candidateNumbers = scopedConflictCandidates(code);
    const memberResult = await db.from("bgm_members")
      .select("id,member_number,full_name,status,membership_expiry,cancellation_effective_date,archived_at,access_scope,access_gym_id,pending_access_scope,pending_access_gym_id,pending_access_effective_date,enrollment_gym_id,official_photo_path")
      .eq("id", memberId).maybeSingle();
    if (memberResult.error) throw memberResult.error;
    const member = memberResult.data;
    if (!member || member.archived_at) {
      return NextResponse.json({ error: "Member unavailable." }, { status: 404 });
    }

    const [legacy, modern, nfc, gym] = await Promise.all([
      db.from("bgm_legacy_card_claims").select("member_id,scan3,assignment_status")
        .ilike("scan3", code),
      db.from("bgm_member_card_credentials").select("member_id,barcode_value,status,application_member_id")
        .ilike("barcode_value", code),
      db.from("bgm_nfc_cards").select("member_id,card_uid,status").ilike("card_uid", code),
      db.from("bgm_gyms").select("id,name,status").eq("id", scan.gym_id).maybeSingle(),
    ]);
    if (legacy.error) throw legacy.error;
    if (modern.error) throw modern.error;
    if (nfc.error) throw nfc.error;
    if (gym.error) throw gym.error;
    if (!gym.data || gym.data.status !== "active") {
      return NextResponse.json({ error: "Gym is not active." }, { status: 409 });
    }
    const allCurrentOwners = new Set<string>([
      ...(legacy.data || []).filter(x => x.assignment_status === "active").map(x => x.member_id),
      ...(modern.data || []).filter(x => x.status === "active" && x.member_id).map(x => x.member_id as string),
      ...(nfc.data || []).filter(x => x.status === "active" && x.member_id).map(x => x.member_id as string),
    ]);
    const isExistingOwner = allCurrentOwners.has(member.id);
    const isScopedCandidate = candidateNumbers.includes(member.member_number);
    const pending = await db.from("bgm_pending_legacy_card_verifications").select("member_id,source_row_number").eq("scan3", code).eq("status", "pending");
    if (pending.error) throw pending.error;
    const pendingIds = (pending.data || []).map(x => x.member_id);
    const currentLegacyIds = (legacy.data || []).filter(x => x.assignment_status === "active").map(x => x.member_id);
    const modernRows = modern.data || [];
    const eligibleFlaggedModern = modernRows.length === 1 && modernRows[0].status === "active" &&
      Boolean(modernRows[0].member_id) && !modernRows[0].application_member_id &&
      pendingIds.length > 0 && (pending.data || []).every(row => row.source_row_number === null);
    const sharedLegacy = (currentLegacyIds.length > 1 || pendingIds.length > 0) &&
      (!modernRows.length || eligibleFlaggedModern) && !(nfc.data || []).length;
    if (!candidateNumbers.length && !sharedLegacy) {
      return NextResponse.json({ error: "This card is not an eligible shared legacy conflict. Please rescan or ask Super Admin." }, { status: 403 });
    }
    if (!isExistingOwner && !isScopedCandidate && !pendingIds.includes(member.id)) {
      return NextResponse.json({ error: "The selected member is not a verified match for this scanned card." }, { status: 403 });
    }

    const access = evaluateBarcodeAccess({
      member: {
        status: member.status, membershipExpiry: member.membership_expiry,
        cancellationEffectiveDate: member.cancellation_effective_date,
        accessScope: member.access_scope, accessGymId: member.access_gym_id,
        pendingAccessScope: member.pending_access_scope,
        pendingAccessGymId: member.pending_access_gym_id,
        pendingAccessEffectiveDate: member.pending_access_effective_date,
      },
      today: todayMaltaDate(), gymId: scan.gym_id,
    });
    if (!access.granted && body.resolveSharedLegacy !== true) {
      return NextResponse.json({ error:
        access.result === "expired" ? "Membership expired — no access granted." :
        access.result === "restricted_gym" ? "This membership does not allow entry at this gym." :
        "Member inactive — no access granted." }, { status: 409 });
    }

    let permanentlyAssigned = false;
    let finalAccess = access;
    let sharedScanCompleted = false;
    if (body.resolveSharedLegacy === true) {
      if (!sharedLegacy || !(currentLegacyIds.includes(member.id) || pendingIds.includes(member.id) || (eligibleFlaggedModern && isExistingOwner)) || !Array.isArray(body.expectedMemberIds) ||
          !body.expectedMemberIds.every((id: unknown) => typeof id === "string")) {
        return NextResponse.json({ error: "Shared card claims changed. Rescan before confirming." }, { status: 409 });
      }
      const resolved = await db.rpc("bgm_staff_resolve_shared_legacy_card", {
        p_scan_id: scan.id, p_staff_id: auth.context.systemUserId, p_member_id: member.id,
        p_expected_ids: body.expectedMemberIds,
      });
      if (resolved.error || !resolved.data?.resolved) {
        return NextResponse.json({ error: "Shared card could not be resolved safely. Rescan or flag to Super Admin." }, { status: 409 });
      }
      permanentlyAssigned = true;
      const result = resolved.data.result;
      if (!["granted", "expired", "inactive", "restricted_gym"].includes(result)) throw new Error("Invalid shared scan result");
      finalAccess = { result, granted: result === "granted" };
      sharedScanCompleted = true;
    } else if (sharedLegacy && !candidateNumbers.length) {
      return NextResponse.json({ error: "Confirm the shared legacy card assignment first." }, { status: 409 });
    } else if (!isExistingOwner) {
      // Never steal a card from any existing owner (inside OR outside the 32).
      if (allCurrentOwners.size > 0) {
        return NextResponse.json({
          error: "This physical card is already assigned to another member. Their assignment was NOT changed. Verify a different card or use the Super Admin replacement procedure.",
        }, { status: 409 });
      }
      if ((legacy.data || []).length || (modern.data || []).length || (nfc.data || []).length) {
        return NextResponse.json({ error: "This card has an existing or retired credential. Super Admin review is required." }, { status: 409 });
      }
      const ownCards = await Promise.all([
        db.from("bgm_member_card_credentials").select("id").eq("member_id", member.id).limit(1),
        db.from("bgm_legacy_card_claims").select("member_id").eq("member_id", member.id).limit(1),
        db.from("bgm_nfc_cards").select("id").eq("member_id", member.id).limit(1),
      ]);
      for (const response of ownCards) if (response.error) throw response.error;
      if (ownCards.some(response => (response.data || []).length)) {
        return NextResponse.json({ error: "This member already has card history. Super Admin review is required." }, { status: 409 });
      }
      // The database's existing barcode UNIQUE index and card-ownership trigger
      // protect against two staff resolving the same barcode concurrently.
      const assign = await db.from("bgm_member_card_credentials").insert({
        barcode_value: code, member_id: member.id, status: "active",
        activated_at: new Date().toISOString(),
        created_by_system_user_id: auth.context.systemUserId,
      }).select("id").single();
      if (assign.error || !assign.data?.id) {
        return NextResponse.json({ error: "Card assignment changed or conflicts with another member. Please rescan; no other member was modified." }, { status: 409 });
      }
      permanentlyAssigned = true;
      const audit = await db.from("bgm_audit_log").insert({
        system_user_id: auth.context.systemUserId,
        context_gym_id: scan.gym_id, staff_name: auth.context.displayName,
        action_key: "member.card.scoped_conflict_staff_verified",
        entity_type: "member", entity_id: member.id, member_id: member.id,
        before_data: { physicalCard: null, sourceScanId: scan.id },
        after_data: { physicalCard: code, verifiedMemberNumber: member.member_number,
          sourceScanId: scan.id, permanent: true, scope: "2026-11-24 32 exceptions",
          noExistingCardReassigned: true },
      });
      if (audit.error) {
        // Do not silently succeed without accountability. Undo only the
        // credential created by THIS request; never alter another member.
        const undo = await db.from("bgm_member_card_credentials")
          .delete().eq("id", assign.data.id).eq("member_id", member.id);
        if (undo.error) console.error("New credential rollback failed:", undo.error);
        console.error("Card assignment audit failed:", audit.error);
        return NextResponse.json({ error: "Audit could not be recorded. Card verification was not finalized; ask Super Admin to review." }, { status: 500 });
      }
    }

    // Only the originating staff and gym can complete this one scan.
    if (!sharedScanCompleted) {
    const update = await db.from("bgm_access_scans").update({
      result: "granted", member_id: member.id,
      membership_expiry_snapshot: member.membership_expiry,
      photo_required_warning: !member.official_photo_path,
    }).eq("id", scan.id).eq("result", "ambiguous_card")
      .eq("system_user_id", auth.context.systemUserId).select("id");
    if (update.error) throw update.error;
    if (!(update.data || []).length) {
      return NextResponse.json({ error: "Scan already resolved. Please scan again." }, { status: 409 });
    }

    }
    let duplicate = false;
    if (finalAccess.granted) {
    const checkin = await recordCanonicalCheckin({
      memberId: member.id, gymId: scan.gym_id, source: "barcode",
    });
    const finish = await db.from("bgm_access_scans").update({
      checkin_id: checkin.checkinId,
    }).eq("id", scan.id).eq("member_id", member.id);
    if (finish.error) throw finish.error;
    duplicate = checkin.duplicate;
    }
    return NextResponse.json({
      result: finalAccess.result, granted: finalAccess.granted, duplicate,
      permanentlyAssigned, currentPhysicalCard: code, cardStatus: "active",
      credentialKind: "physical_card", scannedBarcode: code,
      cardMatches: [], scanId: scan.id,
      member: {
        id: member.id, memberNumber: member.member_number,
        fullName: member.full_name, status: member.status,
        membershipExpiry: member.membership_expiry,
        accessScope: member.access_scope,
        enrollmentGymId: member.enrollment_gym_id,
        enrollmentGymName: "", accessGymName: gym.data.name,
        hasPhoto: Boolean(member.official_photo_path),
        photoRequired: !member.official_photo_path,
        photoUrl: member.official_photo_path
          ? `/api/system/members/photo/${encodeURIComponent(member.id)}?inline=1`
          : null,
      },
    });
  } catch (error) {
    console.error("Scoped card conflict assignment failed", error);
    return NextResponse.json({ error: "Could not verify this card safely. No existing member card was transferred." }, { status: 500 });
  }
}
