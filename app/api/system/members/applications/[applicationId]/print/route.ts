import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select(
        "id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, submitted_at, payment_received_at, activated_at"
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }

    if (
      !auth.context.isSuperAdmin &&
      auth.context.gymId !== application.enrollment_gym_id
    ) {
      return NextResponse.json(
        { error: "This application belongs to another gym." },
        { status: 403 }
      );
    }

    const [participantsResult, gymResult, membershipResult] = await Promise.all([
      supabase
        .from("bgm_membership_application_members")
        .select(
          "id, participant_order, first_name, last_name, address_line_1, address_line_2, postcode, id_number, date_of_birth, phone, email, next_of_kin, official_photo_path, existing_member_id, renewal_scanned_barcode"
        )
        .eq("application_id", applicationId)
        .order("participant_order", { ascending: true }),
      supabase
        .from("bgm_gyms")
        .select("id, name")
        .eq("id", application.enrollment_gym_id)
        .maybeSingle(),
      supabase
        .from("bgm_memberships")
        .select("id, activation_staff_name, activated_by_system_user_id, status")
        .eq("application_id", applicationId)
        .maybeSingle(),
    ]);

    if (participantsResult.error) throw participantsResult.error;
    if (gymResult.error) throw gymResult.error;
    if (membershipResult.error) throw membershipResult.error;

    const participants = participantsResult.data || [];
    const participantIds = participants.map((participant) => participant.id);
    const existingMemberIds = participants
      .map((participant) => participant.existing_member_id)
      .filter((value): value is string => Boolean(value));

    const [reservedCardsResult, activeCardsResult, membersResult] = await Promise.all([
      participantIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("application_member_id, barcode_value")
            .in("application_member_id", participantIds)
            .eq("status", "reserved")
        : Promise.resolve({ data: [], error: null }),
      existingMemberIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("member_id, barcode_value")
            .in("member_id", existingMemberIds)
            .eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
      existingMemberIds.length
        ? supabase
            .from("bgm_members")
            .select("id, member_number, official_photo_path")
            .in("id", existingMemberIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (reservedCardsResult.error) throw reservedCardsResult.error;
    if (activeCardsResult.error) throw activeCardsResult.error;
    if (membersResult.error) throw membersResult.error;

    const reservedByParticipant = new Map(
      (reservedCardsResult.data || []).map((card) => [card.application_member_id, card.barcode_value])
    );
    const activeCardByMember = new Map(
      (activeCardsResult.data || []).map((card) => [card.member_id, card.barcode_value])
    );
    const memberById = new Map(
      (membersResult.data || []).map((member) => [member.id, member])
    );

    const printableParticipants = participants.map((participant) => {
      const existingMember = participant.existing_member_id
        ? memberById.get(participant.existing_member_id)
        : null;
      const barcode =
        reservedByParticipant.get(participant.id) ||
        (participant.existing_member_id
          ? activeCardByMember.get(participant.existing_member_id)
          : null) ||
        participant.renewal_scanned_barcode ||
        existingMember?.member_number ||
        null;
      const photoUrl = participant.official_photo_path
        ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
        : participant.existing_member_id && existingMember?.official_photo_path
          ? `/api/system/members/photo/${encodeURIComponent(participant.existing_member_id)}`
          : null;

      return {
        id: participant.id,
        participantOrder: participant.participant_order,
        firstName: participant.first_name || "",
        lastName: participant.last_name || "",
        addressLine1: participant.address_line_1 || "",
        addressLine2: participant.address_line_2 || "",
        postcode: participant.postcode || "",
        idNumber: participant.id_number || "",
        dateOfBirth: participant.date_of_birth || "",
        phone: participant.phone || "",
        email: participant.email || "",
        nextOfKin: participant.next_of_kin || "",
        memberId: participant.existing_member_id || null,
        barcode,
        photoUrl,
      };
    });

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.application.print_requested",
      entity_type: "membership_application",
      entity_id: application.id,
      after_data: {
        applicationReference: application.application_reference,
        status: application.status,
      },
    });
    if (auditResult.error) console.error(auditResult.error);

    return NextResponse.json({
      application: {
        id: application.id,
        applicationReference: application.application_reference,
        kind: application.application_kind,
        membershipType: application.membership_type,
        durationKey: application.duration_key,
        startDate: application.start_date,
        expiryDate: application.expiry_date,
        status: application.status,
        submittedAt: application.submitted_at,
        paymentReceivedAt: application.payment_received_at,
        activatedAt: application.activated_at,
        applicationStaffName: application.staff_name,
        activationStaffName: membershipResult.data?.activation_staff_name || null,
        enrollmentGymId: application.enrollment_gym_id,
        enrollmentGymName: gymResult.data?.name || application.enrollment_gym_id,
        participants: printableParticipants,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not prepare this membership application for printing." },
      { status: 500 }
    );
  }
}
