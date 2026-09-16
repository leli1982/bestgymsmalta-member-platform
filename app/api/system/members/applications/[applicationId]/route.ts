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
      "id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, staff_name, status, submitted_at, payment_received_at, activated_at, created_at, updated_at"
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
      return NextResponse.json(
        { error: "Membership application not found." },
        { status: 404 }
      );
    }

    const scopeError = gymScopeError(application, auth.context);
    if (scopeError) return scopeError;

    const [participantsResult, gymResult] = await Promise.all([
      supabase
        .from("bgm_membership_application_members")
        .select(
          "id, application_id, participant_order, first_name, last_name, address_line_1, address_line_2, postcode, id_number, date_of_birth, phone, email, next_of_kin, official_photo_path, existing_member_id, renewal_card_action, renewal_scanned_barcode, renewal_card_verified_at"
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
    const existingMemberIds = participants
      .map((participant) => participant.existing_member_id)
      .filter((value): value is string => Boolean(value));

    const [reservedCardsResult, existingMembersResult, activeCardsResult] =
      await Promise.all([
        participantIds.length
          ? supabase
              .from("bgm_member_card_credentials")
              .select("application_member_id, barcode_value, status")
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
              .select("member_id, barcode_value, status")
              .in("member_id", existingMemberIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (reservedCardsResult.error) throw reservedCardsResult.error;
    if (existingMembersResult.error) throw existingMembersResult.error;
    if (activeCardsResult.error) throw activeCardsResult.error;

    const reservedByParticipant = new Map(
      (reservedCardsResult.data || []).map((card) => [
        card.application_member_id,
        card,
      ])
    );
    const memberById = new Map(
      (existingMembersResult.data || []).map((member) => [member.id, member])
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
        participants: participants.map((participant) => {
          const existingMember = participant.existing_member_id
            ? memberById.get(participant.existing_member_id)
            : null;
          const reservedCard = reservedByParticipant.get(participant.id);
          const activeCard = participant.existing_member_id
            ? activeCardByMember.get(participant.existing_member_id)
            : null;
          const photoUrl = participant.official_photo_path
            ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}`
            : existingMember?.official_photo_path
              ? `/api/system/members/photo/${encodeURIComponent(existingMember.id)}`
              : null;

          return {
            id: participant.id,
            participantOrder: participant.participant_order,
            existingMemberId: participant.existing_member_id || null,
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
            hasPhoto: Boolean(
              participant.official_photo_path || existingMember?.official_photo_path
            ),
            photoUrl,
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
      return NextResponse.json(
        { error: "Membership application not found." },
        { status: 404 }
      );
    }

    const scopeError = gymScopeError(application, auth.context);
    if (scopeError) return scopeError;
    if (!PENDING_STATUSES.has(application.status)) {
      return NextResponse.json(
        { error: "This membership application is no longer editable." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const membershipType = clean(body.membershipType).toLowerCase();
    const durationKey = clean(body.durationKey).toLowerCase();
    const startDate = clean(body.startDate);
    const expiryDate = clean(body.expiryDate);
    const rawParticipants: ParticipantCorrectionInput[] = Array.isArray(
      body.participants
    )
      ? body.participants
      : [];

    if (!MEMBERSHIP_TYPES.has(membershipType)) {
      return NextResponse.json(
        { error: "Select a valid membership type." },
        { status: 400 }
      );
    }
    if (!DURATION_KEYS.has(durationKey)) {
      return NextResponse.json(
        { error: "Select a valid membership duration." },
        { status: 400 }
      );
    }
    if (!isIsoDate(startDate) || !isIsoDate(expiryDate)) {
      return NextResponse.json(
        { error: "Valid membership start and expiry dates are required." },
        { status: 400 }
      );
    }
    if (expiryDate < startDate) {
      return NextResponse.json(
        { error: "Membership expiry date cannot be before the start date." },
        { status: 400 }
      );
    }

    const expectedParticipants = membershipType === "couples" ? 2 : 1;
    if (rawParticipants.length !== expectedParticipants) {
      return NextResponse.json(
        { error: "Membership type and participant count do not match." },
        { status: 400 }
      );
    }

    const participants = rawParticipants.map((participant, index) => ({
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
    }));

    if (
      participants.some(
        (participant) =>
          !participant.id ||
          !participant.firstName ||
          !participant.lastName ||
          !Number.isInteger(participant.participantOrder)
      )
    ) {
      return NextResponse.json(
        { error: "Participant identity, first name and surname are required." },
        { status: 400 }
      );
    }

    if (
      participants.some(
        (participant) =>
          participant.dateOfBirth && !isIsoDate(participant.dateOfBirth)
      )
    ) {
      return NextResponse.json(
        { error: "Participant date of birth must be a valid date." },
        { status: 400 }
      );
    }

    const correctionResult = await supabase.rpc(
      "bgm_correct_membership_application",
      {
        p_application_id: applicationId,
        p_system_user_id: auth.context.systemUserId,
        p_membership_type: membershipType,
        p_duration_key: durationKey,
        p_start_date: startDate,
        p_expiry_date: expiryDate,
        p_participants: participants,
      }
    );

    if (correctionResult.error) {
      console.error(correctionResult.error);
      const message = String(correctionResult.error.message || "");
      const expectedValidation =
        /required|not found|no longer editable|another gym|valid membership|participant|cannot be changed|do not match|before the start date/i.test(
          message
        );
      return NextResponse.json(
        {
          error: expectedValidation
            ? message
            : "Could not save the membership application corrections.",
        },
        { status: expectedValidation ? 409 : 500 }
      );
    }

    await broadcastStaffMembershipRefresh(application.enrollment_gym_id);

    return NextResponse.json({ ok: true, correction: correctionResult.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not save the membership application corrections." },
      { status: 500 }
    );
  }
}
