import { NextRequest, NextResponse } from "next/server";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "cards.assign");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    let applicationsQuery = supabase
      .from("bgm_membership_applications")
      .select("id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, created_at")
      .eq("application_kind", "new")
      .in("status", ["submitted", "awaiting_payment"])
      .order("created_at", { ascending: true });

    if (!auth.context.isSuperAdmin && auth.context.gymId) {
      applicationsQuery = applicationsQuery.eq("enrollment_gym_id", auth.context.gymId);
    }

    const applicationsResult = await applicationsQuery;
    if (applicationsResult.error) throw applicationsResult.error;
    const applications = applicationsResult.data || [];
    if (applications.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    const applicationIds = applications.map((application) => application.id);
    const participantsResult = await supabase
      .from("bgm_membership_application_members")
      .select("id, application_id, participant_order, first_name, last_name, official_photo_path")
      .in("application_id", applicationIds)
      .order("participant_order", { ascending: true });
    if (participantsResult.error) throw participantsResult.error;

    const participants = participantsResult.data || [];
    const participantIds = participants.map((participant) => participant.id);
    const cardsResult = participantIds.length
      ? await supabase
          .from("bgm_member_card_credentials")
          .select("id, application_member_id, barcode_value, status")
          .in("application_member_id", participantIds)
          .eq("status", "reserved")
      : { data: [], error: null };
    if (cardsResult.error) throw cardsResult.error;

    const cardByParticipant = new Map(
      (cardsResult.data || []).map((card) => [card.application_member_id, card])
    );
    const participantsByApplication = new Map<string, any[]>();
    for (const participant of participants) {
      const list = participantsByApplication.get(participant.application_id) || [];
      const card = cardByParticipant.get(participant.id);
      list.push({
        id: participant.id,
        participantOrder: participant.participant_order,
        fullName: `${participant.first_name} ${participant.last_name}`.trim(),
        hasPhoto: Boolean(participant.official_photo_path),
        photoUrl: participant.official_photo_path
          ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
          : null,
        reservedBarcode: card?.barcode_value || null,
      });
      participantsByApplication.set(participant.application_id, list);
    }

    return NextResponse.json({
      applications: applications.map((application) => ({
        id: application.id,
        reference: application.application_reference,
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
      .select("id, application_id, first_name, last_name")
      .eq("id", applicationMemberId)
      .maybeSingle();
    if (participantResult.error) throw participantResult.error;
    if (!participantResult.data) {
      return NextResponse.json({ error: "Application participant not found." }, { status: 404 });
    }

    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id, application_kind, enrollment_gym_id, status")
      .eq("id", participantResult.data.application_id)
      .maybeSingle();
    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }
    if (application.application_kind !== "new") {
      return NextResponse.json({ error: "Use renewal card verification for a renewal." }, { status: 409 });
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json({ error: "This membership application is no longer awaiting activation." }, { status: 409 });
    }
    if (
      !auth.context.isSuperAdmin &&
      auth.context.gymId !== application.enrollment_gym_id
    ) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }

    const existingBarcode = await supabase
      .from("bgm_member_card_credentials")
      .select("id, barcode_value, application_member_id, member_id, status")
      .eq("barcode_value", barcode)
      .maybeSingle();
    if (existingBarcode.error) throw existingBarcode.error;

    if (existingBarcode.data) {
      if (
        existingBarcode.data.status === "reserved" &&
        existingBarcode.data.application_member_id === applicationMemberId &&
        !existingBarcode.data.member_id
      ) {
        return NextResponse.json({
          ok: true,
          reservation: {
            id: existingBarcode.data.id,
            applicationMemberId,
            barcodeValue: existingBarcode.data.barcode_value,
            status: "reserved",
          },
        });
      }
      return NextResponse.json(
        { error: "That card barcode has already been issued or reserved and cannot be reused." },
        { status: 409 }
      );
    }

    const currentReservation = await supabase
      .from("bgm_member_card_credentials")
      .select("id, barcode_value, status, member_id")
      .eq("application_member_id", applicationMemberId)
      .eq("status", "reserved")
      .maybeSingle();
    if (currentReservation.error) throw currentReservation.error;

    if (currentReservation.data && currentReservation.data.barcode_value !== barcode) {
      const releaseResult = await supabase
        .from("bgm_member_card_credentials")
        .delete()
        .eq("id", currentReservation.data.id)
        .eq("status", "reserved")
        .is("member_id", null);
      if (releaseResult.error) throw releaseResult.error;
    }

    const insertResult = await supabase
      .from("bgm_member_card_credentials")
      .insert({
        barcode_value: barcode,
        application_member_id: applicationMemberId,
        member_id: null,
        status: "reserved",
        created_by_system_user_id: auth.context.systemUserId,
      })
      .select("id, barcode_value, application_member_id, status")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return NextResponse.json(
          { error: "That card barcode is already reserved or has previously been issued." },
          { status: 409 }
        );
      }
      throw insertResult.error;
    }

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.card.reserve",
      entity_type: "membership_application_member",
      entity_id: applicationMemberId,
      after_data: {
        applicationId: application.id,
        barcodeValue: barcode,
        status: "reserved",
      },
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({
      ok: true,
      reservation: {
        id: insertResult.data.id,
        applicationMemberId: insertResult.data.application_member_id,
        barcodeValue: insertResult.data.barcode_value,
        status: insertResult.data.status,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not reserve membership card." }, { status: 500 });
  }
}
