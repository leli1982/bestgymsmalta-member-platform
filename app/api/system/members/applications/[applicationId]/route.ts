import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { broadcastStaffMembershipRefresh } from "@/lib/staffRealtime";

export const dynamic = "force-dynamic";

const MEMBERSHIP_TYPES = new Set(["single", "couples", "student"]);
const DURATION_KEYS = new Set([
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
]);
const PENDING_STATUSES = new Set(["submitted", "awaiting_payment"]);

type ParticipantCorrectionInput = {
  id?: unknown;
  participantOrder?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  postcode?: unknown;
  idNumber?: unknown;
  dateOfBirth?: unknown;
  phone?: unknown;
  email?: unknown;
  nextOfKin?: unknown;
  idVerified?: unknown;
  studentEligibilityVerified?: unknown;
  guardianPresentVerified?: unknown;
  guardianCosignVerified?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function optional(value: unknown) {
  const result = clean(value);
  return result || null;
}

function normalizeEmail(value: unknown) {
  const email = clean(value).toLowerCase();
  return email || null;
}

function bool(value: unknown) {
  return value === true;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function loadApplication(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  applicationId: string
) {
  const result = await supabase
    .from("bgm_membership_applications")
    .select(
      "id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, submitted_at, payment_received_at, activated_at, created_at, updated_at, base_price_cents, currency, price_catalog_version_id, declaration_snapshot, same_address_verified_at"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

function gymScopeError(
  application: { enrollment_gym_id: string },
  context: { gymId: string | null; isSuperAdmin: boolean }
) {
  if (context.isSuperAdmin) return null;
  if (context.gymId && context.gymId === application.enrollment_gym_id) return null;
  return NextResponse.json(
    { error: "This application belongs to another gym." },
    { status: 403 }
  );
}

function validationResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeReviewParticipants(rawParticipants: ParticipantCorrectionInput[]) {
  return rawParticipants.map((participant, index) => ({
    id: clean(participant.id),
    participantOrder: Number(participant.participantOrder || index + 1),
    firstName: clean(participant.firstName),
    lastName: clean(participant.lastName),
    addressLine1: optional(participant.addressLine1),
    addressLine2: optional(participant.addressLine2),
    postcode: optional(participant.postcode),
    idNumber: optional(participant.idNumber),
    dateOfBirth: optional(participant.dateOfBirth),
    phone: optional(participant.phone),
    email: normalizeEmail(participant.email),
    nextOfKin: optional(participant.nextOfKin),
    idVerified: bool(participant.idVerified),
    studentEligibilityVerified: bool(participant.studentEligibilityVerified),
    guardianPresentVerified: bool(participant.guardianPresentVerified),
    guardianCosignVerified: bool(participant.guardianCosignVerified),
  }));
}

function validateReviewInput(body: any) {
  const membershipType = clean(body.membershipType).toLowerCase();
  const durationKey = clean(body.durationKey).toLowerCase();
  const startDate = clean(body.startDate);
  const expiryDate = clean(body.expiryDate);
  const rawParticipants: ParticipantCorrectionInput[] = Array.isArray(body.participants)
    ? body.participants
    : [];

  if (!MEMBERSHIP_TYPES.has(membershipType)) {
    return { error: "Select a valid membership type." } as const;
  }
  if (!DURATION_KEYS.has(durationKey)) {
    return { error: "Select a valid membership duration." } as const;
  }
  if (!isIsoDate(startDate) || !isIsoDate(expiryDate)) {
    return { error: "Valid membership start and expiry dates are required." } as const;
  }
  if (expiryDate < startDate) {
    return { error: "Membership expiry date cannot be before the start date." } as const;
  }

  const expectedParticipants = membershipType === "couples" ? 2 : 1;
  if (rawParticipants.length !== expectedParticipants) {
    return { error: "Membership type and participant count do not match." } as const;
  }

  const participants = normalizeReviewParticipants(rawParticipants);
  if (
    participants.some(
      (participant) =>
        !participant.id ||
        !participant.firstName ||
        !participant.lastName ||
        !Number.isInteger(participant.participantOrder)
    )
  ) {
    return { error: "Participant identity, first name and surname are required." } as const;
  }

  if (
    participants.some(
      (participant) =>
        participant.dateOfBirth && !isIsoDate(participant.dateOfBirth)
    )
  ) {
    return { error: "Participant date of birth must be a valid date." } as const;
  }

  return {
    membershipType,
    durationKey,
    startDate,
    expiryDate,
    participants,
    sameAddressVerified: bool(body.sameAddressVerified),
  } as const;
}

function rpcErrorResponse(error: { message?: string | null }, fallback: string) {
  const message = String(error.message || "");
  const expectedValidation =
    /required|not found|no longer|another gym|valid membership|participant|cannot|do not match|before the start date|possible renewal|active|rejection reason/i.test(
      message
    );
  return NextResponse.json(
    { error: expectedValidation ? message : fallback },
    { status: expectedValidation ? 409 : 500 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const supabase = getSupabaseAdmin();
    const application = await loadApplication(supabase, applicationId);
    if (!application) {
      return validationResponse("Membership application not found.", 404);
    }

    const scopeError = gymScopeError(application, auth.context);
    if (scopeError) return scopeError;

    const [participantsResult, gymResult] = await Promise.all([
      supabase
        .from("bgm_membership_application_members")
        .select(
          "id, application_id, participant_order, first_name, last_name, address_line_1, address_line_2, town, postcode, id_number, date_of_birth, phone, email, next_of_kin, official_photo_path, existing_member_id, matched_member_id, identity_match_state, duplicate_contact_warning, under_18_at_submission, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address, id_verified_at, student_eligibility_verified_at, guardian_present_verified_at, guardian_cosign_verified_at, renewal_card_action, renewal_scanned_barcode, renewal_card_verified_at"
        )
        .eq("application_id", applicationId)
        .order("participant_order", { ascending: true }),
      supabase
        .from("bgm_gyms")
        .select("id, name")
        .eq("id", application.enrollment_gym_id)
        .maybeSingle(),
    ]);

    if (participantsResult.error) throw participantsResult.error;
    if (gymResult.error) throw gymResult.error;

    const participants = participantsResult.data || [];
    const participantIds = participants.map((participant) => participant.id);
    const relatedMemberIds = Array.from(
      new Set(
        participants
          .flatMap((participant) => [
            participant.existing_member_id,
            participant.matched_member_id,
          ])
          .filter((value): value is string => Boolean(value))
      )
    );

    const [reservedCardsResult, membersResult, activeCardsResult] =
      await Promise.all([
        participantIds.length
          ? supabase
              .from("bgm_member_card_credentials")
              .select("application_member_id, barcode_value, status")
              .in("application_member_id", participantIds)
              .eq("status", "reserved")
          : Promise.resolve({ data: [], error: null }),
        relatedMemberIds.length
          ? supabase
              .from("bgm_members")
              .select("id, member_number, official_photo_path, status, membership_expiry, full_name")
              .in("id", relatedMemberIds)
          : Promise.resolve({ data: [], error: null }),
        relatedMemberIds.length
          ? supabase
              .from("bgm_member_card_credentials")
              .select("member_id, barcode_value, status")
              .in("member_id", relatedMemberIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (reservedCardsResult.error) throw reservedCardsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (activeCardsResult.error) throw activeCardsResult.error;

    const reservedByParticipant = new Map(
      (reservedCardsResult.data || []).map((card) => [
        card.application_member_id,
        card,
      ])
    );
    const memberById = new Map(
      (membersResult.data || []).map((member) => [member.id, member])
    );
    const activeCardByMember = new Map(
      (activeCardsResult.data || []).map((card) => [card.member_id, card])
    );

    return NextResponse.json({
      application: {
        id: application.id,
        reference: application.application_reference,
        kind: application.application_kind,
        status: application.status,
        membershipType: application.membership_type,
        durationKey: application.duration_key,
        startDate: application.start_date || "",
        expiryDate: application.expiry_date || "",
        enrollmentGymId: application.enrollment_gym_id,
        enrollmentGymName:
          gymResult.data?.name || application.enrollment_gym_id,
        submittedAt: application.submitted_at,
        paymentReceivedAt: application.payment_received_at,
        activatedAt: application.activated_at,
        basePriceCents: application.base_price_cents,
        currency: application.currency || "EUR",
        priceCatalogVersionId: application.price_catalog_version_id,
        declarationSnapshot: application.declaration_snapshot,
        sameAddressVerified: Boolean(application.same_address_verified_at),
        participants: participants.map((participant) => {
          const existingMember = participant.existing_member_id
            ? memberById.get(participant.existing_member_id)
            : null;
          const matchedMember = participant.matched_member_id
            ? memberById.get(participant.matched_member_id)
            : null;
          const reservedCard = reservedByParticipant.get(participant.id);
          const currentMemberId =
            participant.existing_member_id || participant.matched_member_id;
          const activeCard = currentMemberId
            ? activeCardByMember.get(currentMemberId)
            : null;
          const applicationPhotoUrl = participant.official_photo_path
            ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
            : null;
          const existingPhotoUrl = existingMember?.official_photo_path
            ? `/api/system/members/photo/${encodeURIComponent(existingMember.id)}`
            : null;
          const matchedMemberPhotoUrl = matchedMember?.official_photo_path
            ? `/api/system/members/photo/${encodeURIComponent(matchedMember.id)}`
            : null;

          return {
            id: participant.id,
            participantOrder: participant.participant_order,
            existingMemberId: participant.existing_member_id || null,
            matchedMemberId: participant.matched_member_id || null,
            identityMatchState: participant.identity_match_state || "clear",
            duplicateContactWarning: Boolean(participant.duplicate_contact_warning),
            under18AtSubmission: Boolean(participant.under_18_at_submission),
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
            hasPhoto: Boolean(
              participant.official_photo_path || existingMember?.official_photo_path
            ),
            photoUrl: applicationPhotoUrl || existingPhotoUrl,
            applicationPhotoUrl,
            matchedMemberPhotoUrl,
            matchedMemberNumber: matchedMember?.member_number || null,
            matchedMemberName: matchedMember?.full_name || null,
            matchedMemberStatus: matchedMember?.status || null,
            matchedMembershipExpiry: matchedMember?.membership_expiry || null,
            reservedBarcode: reservedCard?.barcode_value || null,
            currentBarcode:
              activeCard?.barcode_value || existingMember?.member_number || null,
            cardVerified: Boolean(participant.renewal_card_verified_at),
            renewalCardAction: participant.renewal_card_action || null,
            scannedBarcode: participant.renewal_scanned_barcode || null,
          };
        }),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load the membership application." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const supabase = getSupabaseAdmin();
    const application = await loadApplication(supabase, applicationId);
    if (!application) {
      return validationResponse("Membership application not found.", 404);
    }

    const scopeError = gymScopeError(application, auth.context);
    if (scopeError) return scopeError;
    if (!PENDING_STATUSES.has(application.status)) {
      return validationResponse(
        "This membership application is no longer editable.",
        409
      );
    }

    const body = await request.json();
    const action = clean(body.action) || "save_corrections";

    if (action === "reuse_existing_member") {
      const applicationMemberId = clean(body.applicationMemberId);
      if (!applicationMemberId) {
        return validationResponse("Application participant is required.");
      }

      const result = await supabase.rpc(
        "bgm_confirm_membership_existing_member",
        {
          p_application_id: applicationId,
          p_application_member_id: applicationMemberId,
          p_system_user_id: auth.context.systemUserId,
        }
      );
      if (result.error) {
        console.error(result.error);
        return rpcErrorResponse(
          result.error,
          "Could not confirm the existing member."
        );
      }

      await broadcastStaffMembershipRefresh(application.enrollment_gym_id);
      return NextResponse.json({ ok: true, reuse: result.data });
    }

    if (action === "reject_application") {
      const reason = clean(body.reason);
      if (!reason) {
        return validationResponse("A rejection reason is required.");
      }

      const result = await supabase.rpc("bgm_reject_membership_application", {
        p_application_id: applicationId,
        p_system_user_id: auth.context.systemUserId,
        p_reason: reason,
      });
      if (result.error) {
        console.error(result.error);
        return rpcErrorResponse(
          result.error,
          "Could not reject the membership application."
        );
      }

      await broadcastStaffMembershipRefresh(application.enrollment_gym_id);
      return NextResponse.json({ ok: true, rejection: result.data });
    }

    const review = validateReviewInput(body);
    if ("error" in review) {
      return validationResponse(String(review.error));
    }

    if (action === "save_review") {
      const result = await supabase.rpc(
        "bgm_apply_membership_application_review",
        {
          p_review: {
            applicationId,
            systemUserId: auth.context.systemUserId,
            membershipType: review.membershipType,
            durationKey: review.durationKey,
            startDate: review.startDate,
            expiryDate: review.expiryDate,
            sameAddressVerified: review.sameAddressVerified,
            participants: review.participants,
          },
        }
      );

      if (result.error) {
        console.error(result.error);
        return rpcErrorResponse(
          result.error,
          "Could not save the membership review."
        );
      }

      await broadcastStaffMembershipRefresh(application.enrollment_gym_id);
      return NextResponse.json({ ok: true, review: result.data });
    }

    const correctionResult = await supabase.rpc(
      "bgm_correct_membership_application",
      {
        p_application_id: applicationId,
        p_system_user_id: auth.context.systemUserId,
        p_membership_type: review.membershipType,
        p_duration_key: review.durationKey,
        p_start_date: review.startDate,
        p_expiry_date: review.expiryDate,
        p_participants: review.participants.map((participant) => ({
          id: participant.id,
          participantOrder: participant.participantOrder,
          firstName: participant.firstName,
          lastName: participant.lastName,
          addressLine1: participant.addressLine1,
          addressLine2: participant.addressLine2,
          postcode: participant.postcode,
          idNumber: participant.idNumber,
          dateOfBirth: participant.dateOfBirth,
          phone: participant.phone,
          email: participant.email,
          nextOfKin: participant.nextOfKin,
        })),
      }
    );

    if (correctionResult.error) {
      console.error(correctionResult.error);
      return rpcErrorResponse(
        correctionResult.error,
        "Could not save the membership application corrections."
      );
    }

    await broadcastStaffMembershipRefresh(application.enrollment_gym_id);
    return NextResponse.json({ ok: true, correction: correctionResult.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update the membership application." },
      { status: 500 }
    );
  }
}
