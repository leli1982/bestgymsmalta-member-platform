import { NextRequest, NextResponse } from "next/server";
import {
  decideRenewalCardAction,
  normalizeBarcodePayload,
} from "@/lib/memberCardCredentialCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function releaseReservedCard(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  applicationMemberId: string,
  keepBarcode?: string
) {
  let query = supabase
    .from("bgm_member_card_credentials")
    .delete()
    .eq("application_member_id", applicationMemberId)
    .eq("status", "reserved")
    .is("member_id", null);

  if (keepBarcode) query = query.neq("barcode_value", keepBarcode);
  const result = await query;
  if (result.error) throw result.error;
}

async function reserveExactCard(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  applicationMemberId: string,
  barcode: string,
  systemUserId: string
) {
  const existing = await supabase
    .from("bgm_member_card_credentials")
    .select("id, barcode_value, application_member_id, member_id, status")
    .eq("barcode_value", barcode)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    if (
      existing.data.status === "reserved" &&
      existing.data.application_member_id === applicationMemberId &&
      !existing.data.member_id
    ) {
      await releaseReservedCard(supabase, applicationMemberId, barcode);
      return existing.data;
    }
    throw new Error("CARD_BARCODE_CONFLICT");
  }

  await releaseReservedCard(supabase, applicationMemberId);
  const inserted = await supabase
    .from("bgm_member_card_credentials")
    .insert({
      barcode_value: barcode,
      application_member_id: applicationMemberId,
      member_id: null,
      status: "reserved",
      created_by_system_user_id: systemUserId,
    })
    .select("id, barcode_value, application_member_id, member_id, status")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") throw new Error("CARD_BARCODE_CONFLICT");
    throw inserted.error;
  }
  return inserted.data;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "cards.assign");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    let applicationsQuery = supabase
      .from("bgm_membership_applications")
      .select("id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, created_at")
      .in("application_kind", ["new", "renewal"])
      .in("status", ["submitted", "awaiting_payment"])
      .order("created_at", { ascending: true });

    if (!auth.context.isSuperAdmin && auth.context.gymId) {
      applicationsQuery = applicationsQuery.eq("enrollment_gym_id", auth.context.gymId);
    }

    const applicationsResult = await applicationsQuery;
    if (applicationsResult.error) throw applicationsResult.error;
    const applications = applicationsResult.data || [];
    if (applications.length === 0) return NextResponse.json({ applications: [] });

    const applicationIds = applications.map((application) => application.id);
    const participantsResult = await supabase
      .from("bgm_membership_application_members")
      .select("id, application_id, participant_order, first_name, last_name, official_photo_path, existing_member_id, renewal_card_action, renewal_scanned_barcode, renewal_card_verified_at")
      .in("application_id", applicationIds)
      .order("participant_order", { ascending: true });
    if (participantsResult.error) throw participantsResult.error;

    const participants = participantsResult.data || [];
    const participantIds = participants.map((participant) => participant.id);
    const existingMemberIds = Array.from(
      new Set(
        participants
          .map((participant) => participant.existing_member_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const [cardsResult, membersResult, activeCardsResult] = await Promise.all([
      participantIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("id, application_member_id, barcode_value, status")
            .in("application_member_id", participantIds)
            .eq("status", "reserved")
        : Promise.resolve({ data: [], error: null }),
      existingMemberIds.length
        ? supabase
            .from("bgm_members")
            .select("id, member_number, official_photo_path")
            .in("id", existingMemberIds)
        : Promise.resolve({ data: [], error: null }),
      existingMemberIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("id, member_id, barcode_value, status")
            .in("member_id", existingMemberIds)
            .eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (cardsResult.error) throw cardsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (activeCardsResult.error) throw activeCardsResult.error;

    const cardByParticipant = new Map(
      (cardsResult.data || []).map((card) => [card.application_member_id, card])
    );
    const memberById = new Map(
      (membersResult.data || []).map((member) => [member.id, member])
    );
    const activeCardByMember = new Map(
      (activeCardsResult.data || []).map((card) => [card.member_id, card])
    );
    const participantsByApplication = new Map<string, any[]>();

    for (const participant of participants) {
      const list = participantsByApplication.get(participant.application_id) || [];
      const reservedCard = cardByParticipant.get(participant.id);
      const existingMember = participant.existing_member_id
        ? memberById.get(participant.existing_member_id)
        : null;
      const activeCard = participant.existing_member_id
        ? activeCardByMember.get(participant.existing_member_id)
        : null;
      const photoPath = participant.official_photo_path || existingMember?.official_photo_path || null;

      list.push({
        id: participant.id,
        participantOrder: participant.participant_order,
        fullName: `${participant.first_name} ${participant.last_name}`.trim(),
        existingMemberId: participant.existing_member_id || null,
        hasPhoto: Boolean(photoPath),
        photoUrl: participant.official_photo_path
          ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
          : existingMember?.official_photo_path
            ? `/api/system/members/photo/${encodeURIComponent(existingMember.id)}`
            : null,
        reservedBarcode: reservedCard?.barcode_value || null,
        currentBarcode: activeCard?.barcode_value || existingMember?.member_number || null,
        cardVerified: Boolean(participant.renewal_card_verified_at),
        renewalCardAction: participant.renewal_card_action || null,
        scannedBarcode: participant.renewal_scanned_barcode || null,
      });
      participantsByApplication.set(participant.application_id, list);
    }

    return NextResponse.json({
      applications: applications.map((application) => ({
        id: application.id,
        reference: application.application_reference,
        kind: application.application_kind,
        membershipType: application.membership_type,
        durationKey: application.duration_key,
        startDate: application.start_date,
        expiryDate: application.expiry_date,
        enrollmentGymId: application.enrollment_gym_id,
        staffName: application.staff_name,
        status: application.status,
        participants: participantsByApplication.get(application.id) || [],
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load pending membership actions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "cards.assign");
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const applicationMemberId = clean(body.applicationMemberId);
    const barcode = normalizeBarcodePayload(clean(body.barcode));
    if (!applicationMemberId || !barcode) {
      return NextResponse.json(
        { error: "Application participant and card barcode are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const participantResult = await supabase
      .from("bgm_membership_application_members")
      .select("id, application_id, first_name, last_name, existing_member_id")
      .eq("id", applicationMemberId)
      .maybeSingle();
    if (participantResult.error) throw participantResult.error;
    const participant = participantResult.data;
    if (!participant) {
      return NextResponse.json({ error: "Application participant not found." }, { status: 404 });
    }

    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id, application_kind, enrollment_gym_id, status")
      .eq("id", participant.application_id)
      .maybeSingle();
    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json({ error: "This membership application is no longer awaiting activation." }, { status: 409 });
    }
    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }

    if (application.application_kind === "new") {
      try {
        const reservation = await reserveExactCard(
          supabase,
          applicationMemberId,
          barcode,
          auth.context.systemUserId
        );

        const auditResult = await supabase.from("bgm_audit_log").insert({
          system_user_id: auth.context.systemUserId,
          context_gym_id: application.enrollment_gym_id,
          staff_name: null,
          action_key: "membership.card.reserve",
          entity_type: "membership_application_member",
          entity_id: applicationMemberId,
          after_data: { applicationId: application.id, barcodeValue: barcode, status: "reserved" },
        });
        if (auditResult.error) console.error(auditResult.error);

        return NextResponse.json({
          ok: true,
          reservation: {
            id: reservation.id,
            applicationMemberId,
            barcodeValue: reservation.barcode_value,
            status: "reserved",
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === "CARD_BARCODE_CONFLICT") {
          return NextResponse.json(
            { error: "That card barcode has already been issued or reserved and cannot be reused." },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    if (application.application_kind !== "renewal" || !participant.existing_member_id) {
      return NextResponse.json({ error: "Renewal member identity is required." }, { status: 409 });
    }

    const [memberResult, activeCardResult, existingBarcodeResult] = await Promise.all([
      supabase
        .from("bgm_members")
        .select("id, member_number")
        .eq("id", participant.existing_member_id)
        .maybeSingle(),
      supabase
        .from("bgm_member_card_credentials")
        .select("id, barcode_value, member_id, status")
        .eq("member_id", participant.existing_member_id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("bgm_member_card_credentials")
        .select("id, barcode_value, application_member_id, member_id, status")
        .eq("barcode_value", barcode)
        .maybeSingle(),
    ]);
    if (memberResult.error) throw memberResult.error;
    if (activeCardResult.error) throw activeCardResult.error;
    if (existingBarcodeResult.error) throw existingBarcodeResult.error;
    if (!memberResult.data) {
      return NextResponse.json({ error: "Existing renewal member was not found." }, { status: 404 });
    }

    const currentBarcode = activeCardResult.data?.barcode_value || memberResult.data.member_number || null;
    let renewalCardAction = decideRenewalCardAction(currentBarcode, barcode);
    let reservedBarcode: string | null = null;

    const existingBarcode = existingBarcodeResult.data;
    if (existingBarcode) {
      if (
        existingBarcode.status === "active" &&
        existingBarcode.member_id === participant.existing_member_id &&
        existingBarcode.barcode_value === barcode
      ) {
        renewalCardAction = "keep";
        await releaseReservedCard(supabase, applicationMemberId);
      } else if (
        existingBarcode.status === "reserved" &&
        existingBarcode.application_member_id === applicationMemberId &&
        !existingBarcode.member_id
      ) {
        renewalCardAction = "replace";
        reservedBarcode = existingBarcode.barcode_value;
        await releaseReservedCard(supabase, applicationMemberId, barcode);
      } else {
        return NextResponse.json(
          { error: "That card barcode belongs to another member or has already been issued." },
          { status: 409 }
        );
      }
    } else if (renewalCardAction === "replace") {
      try {
        const reservation = await reserveExactCard(
          supabase,
          applicationMemberId,
          barcode,
          auth.context.systemUserId
        );
        reservedBarcode = reservation.barcode_value;
      } catch (error) {
        if (error instanceof Error && error.message === "CARD_BARCODE_CONFLICT") {
          return NextResponse.json(
            { error: "That card barcode is already reserved or has previously been issued." },
            { status: 409 }
          );
        }
        throw error;
      }
    } else {
      // Existing members may predate the card-credential table. Keeping their
      // compatibility barcode is recorded now and bootstrapped atomically at activation.
      await releaseReservedCard(supabase, applicationMemberId);
    }

    const verifiedAt = new Date().toISOString();
    const updateVerification = await supabase
      .from("bgm_membership_application_members")
      .update({
        renewal_card_action: renewalCardAction,
        renewal_scanned_barcode: barcode,
        renewal_card_verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq("id", applicationMemberId);
    if (updateVerification.error) throw updateVerification.error;

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.renewal_card.verify",
      entity_type: "membership_application_member",
      entity_id: applicationMemberId,
      member_id: participant.existing_member_id,
      after_data: {
        applicationId: application.id,
        currentBarcode,
        scannedBarcode: barcode,
        action: renewalCardAction,
        reservedBarcode,
      },
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({
      ok: true,
      verification: {
        applicationMemberId,
        currentBarcode,
        scannedBarcode: barcode,
        renewalCardAction,
        reservedBarcode,
        cardVerified: true,
        verifiedAt,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not process membership card." }, { status: 500 });
  }
}
