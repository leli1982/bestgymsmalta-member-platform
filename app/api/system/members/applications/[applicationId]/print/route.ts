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
        "id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, submitted_at, payment_received_at, activated_at, base_price_cents, currency, discount_code_snapshot, discount_percentage_snapshot, discount_amount_cents, final_amount_cents, payment_method, payment_other_text, payment_staff_name, declaration_snapshot, same_address_verified_at"
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json(
        { error: "Membership application not found." },
        { status: 404 }
      );
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
          "id, participant_order, first_name, last_name, address_line_1, address_line_2, town, postcode, id_number, date_of_birth, phone, email, next_of_kin, official_photo_path, existing_member_id, renewal_scanned_barcode, under_18_at_submission, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address, id_verified_at, student_eligibility_verified_at, guardian_present_verified_at, guardian_cosign_verified_at"
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

    const membershipMembersResult = membershipResult.data?.id
      ? await supabase
          .from("bgm_membership_members")
          .select("membership_id, member_id, member_role")
          .eq("membership_id", membershipResult.data.id)
      : { data: [], error: null };

    if (membershipMembersResult.error) throw membershipMembersResult.error;

    const memberIdByRole = new Map(
      (membershipMembersResult.data || []).map((row) => [row.member_role, row.member_id])
    );

    const resolvedMemberIds = participants.map((participant) => {
      const role = participant.participant_order === 1 ? "primary" : "partner";
      return (
        memberIdByRole.get(role) ||
        participant.existing_member_id ||
        null
      );
    });

    const allMemberIds = Array.from(
      new Set(resolvedMemberIds.filter((value): value is string => Boolean(value)))
    );

    const [reservedCardsResult, activeCardsResult, membersResult] = await Promise.all([
      participantIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("application_member_id, barcode_value")
            .in("application_member_id", participantIds)
            .eq("status", "reserved")
        : Promise.resolve({ data: [], error: null }),
      allMemberIds.length
        ? supabase
            .from("bgm_member_card_credentials")
            .select("member_id, barcode_value")
            .in("member_id", allMemberIds)
            .eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
      allMemberIds.length
        ? supabase
            .from("bgm_members")
            .select("id, member_number, official_photo_path")
            .in("id", allMemberIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (reservedCardsResult.error) throw reservedCardsResult.error;
    if (activeCardsResult.error) throw activeCardsResult.error;
    if (membersResult.error) throw membersResult.error;

    const reservedByParticipant = new Map(
      (reservedCardsResult.data || []).map((card) => [
        card.application_member_id,
        card.barcode_value,
      ])
    );
    const activeCardByMember = new Map(
      (activeCardsResult.data || []).map((card) => [
        card.member_id,
        card.barcode_value,
      ])
    );
    const memberById = new Map(
      (membersResult.data || []).map((member) => [member.id, member])
    );

    const printableParticipants = participants.map((participant, index) => {
      const memberId = resolvedMemberIds[index] || null;
      const member = memberId ? memberById.get(memberId) : null;
      const barcode =
        (memberId ? activeCardByMember.get(memberId) : null) ||
        reservedByParticipant.get(participant.id) ||
        participant.renewal_scanned_barcode ||
        null;

      const photoUrl = memberId && member?.official_photo_path
        ? `/api/system/members/photo/${encodeURIComponent(memberId)}`
        : participant.official_photo_path
          ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
          : null;

      return {
        id: participant.id,
        participantOrder: participant.participant_order,
        firstName: participant.first_name || "",
        lastName: participant.last_name || "",
        addressLine1: participant.address_line_1 || "",
        addressLine2: participant.address_line_2 || "",
        town: participant.town || "",
        postcode: participant.postcode || "",
        idNumber: participant.id_number || "",
        dateOfBirth: participant.date_of_birth || "",
        phone: participant.phone || "",
        email: participant.email || "",
        nextOfKin: participant.next_of_kin || "",
        memberId,
        memberNumber: member?.member_number || null,
        barcode,
        photoUrl,
        under18AtSubmission: Boolean(participant.under_18_at_submission),
        guardianName: participant.guardian_name || "",
        guardianIdNumber: participant.guardian_id_number || "",
        guardianRelationship: participant.guardian_relationship || "",
        guardianPhone: participant.guardian_phone || "",
        guardianEmail: participant.guardian_email || "",
        guardianAddress: participant.guardian_address || "",
        idVerified: Boolean(participant.id_verified_at),
        studentEligibilityVerified: Boolean(
          participant.student_eligibility_verified_at
        ),
        guardianPresentVerified: Boolean(
          participant.guardian_present_verified_at
        ),
        guardianCosignVerified: Boolean(
          participant.guardian_cosign_verified_at
        ),
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
        participantCount: printableParticipants.length,
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
        enrollmentGymName:
          gymResult.data?.name || application.enrollment_gym_id,
        basePriceCents: application.base_price_cents,
        currency: application.currency || "EUR",
        discountCode: application.discount_code_snapshot,
        discountPercentage: application.discount_percentage_snapshot,
        discountAmountCents: application.discount_amount_cents,
        finalAmountCents:
          application.final_amount_cents ?? application.base_price_cents,
        paymentMethod: application.payment_method,
        paymentOtherText: application.payment_other_text,
        paymentStaffName: application.payment_staff_name,
        declarationSnapshot:
          application.declaration_snapshot &&
          typeof application.declaration_snapshot === "object"
            ? application.declaration_snapshot
            : null,
        sameAddressVerified: Boolean(application.same_address_verified_at),
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


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const body = await request.json().catch(() => ({}));
    if (String(body?.action || "") !== "confirm_print") {
      return NextResponse.json({ error: "Invalid print confirmation action." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id, application_reference, enrollment_gym_id, status")
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

    const confirmedAt = new Date().toISOString();
    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: null,
      action_key: "membership.application.print_confirmed",
      entity_type: "membership_application",
      entity_id: application.id,
      after_data: {
        applicationReference: application.application_reference,
        status: application.status,
        confirmedAt,
      },
    });

    if (auditResult.error) throw auditResult.error;

    return NextResponse.json({ ok: true, confirmedAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not confirm that this membership was printed." },
      { status: 500 }
    );
  }
}
