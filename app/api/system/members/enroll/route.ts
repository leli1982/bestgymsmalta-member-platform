import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildEnrollmentIdentityAction,
  requireStaffName,
} from "@/lib/membershipEnrollmentCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

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

function makeApplicationReference() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `BGMAPP-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function participantPayload(participant: any, participantOrder: number, kind: string) {
  const firstName = clean(participant?.firstName);
  const lastName = clean(participant?.lastName);
  const existingMemberId = clean(participant?.existingMemberId);

  if (!firstName || !lastName) {
    throw new Error(`Participant ${participantOrder} first name and surname are required.`);
  }

  const identityAction = buildEnrollmentIdentityAction({
    kind,
    existingMemberId,
  });

  return {
    participant_order: participantOrder,
    first_name: firstName,
    last_name: lastName,
    address_line_1: optional(participant?.addressLine1),
    address_line_2: optional(participant?.addressLine2),
    postcode: optional(participant?.postcode),
    id_number: optional(participant?.idNumber),
    date_of_birth: optional(participant?.dateOfBirth),
    phone: optional(participant?.phone),
    email: normalizeEmail(participant?.email),
    next_of_kin: optional(participant?.nextOfKin),
    official_photo_path: optional(participant?.officialPhotoPath),
    existing_member_id:
      identityAction.kind === "reuse_person" ? identityAction.memberId : null,
  };
}

async function resolveEnrollmentGym(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  authContext: NonNullable<Awaited<ReturnType<typeof requireSystemPermission>>["context"]>,
  requestedGymId: string
) {
  const gymId = authContext.gymId || requestedGymId;

  if (!gymId) {
    throw new Error("An enrollment gym is required.");
  }

  const gymResult = await supabase
    .from("bgm_gyms")
    .select("id, name, status")
    .eq("id", gymId)
    .maybeSingle();

  if (gymResult.error) throw gymResult.error;
  if (!gymResult.data || gymResult.data.status !== "active") {
    throw new Error("Active enrollment gym not found.");
  }

  return gymResult.data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = clean(body.action);

    if (action === "activate") {
      const auth = await requireSystemPermission(request, "membership.activate");
      if (auth.error || !auth.context) return auth.error;

      const applicationId = clean(body.applicationId);
      if (!applicationId) {
        return NextResponse.json(
          { error: "Membership application ID is required." },
          { status: 400 }
        );
      }

      let activationStaffName: string;
      try {
        activationStaffName = requireStaffName(
          body.activationStaffName,
          "Activation Staff Name"
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Activation Staff Name is required." },
          { status: 400 }
        );
      }

      const supabase = getSupabaseAdmin();
      const activationResult = await supabase.rpc(
        "bgm_activate_membership_application",
        {
          p_application_id: applicationId,
          p_activation_staff_name: activationStaffName,
          p_system_user_id: auth.context.systemUserId,
        }
      );

      if (activationResult.error) {
        console.error(activationResult.error);
        const message = String(activationResult.error.message || "");
        const expectedValidation =
          /required|not found|not awaiting activation|invalid participant|cannot reuse|existing member identity|existing renewal member/i.test(
            message
          );
        return NextResponse.json(
          {
            error: expectedValidation
              ? message
              : "Could not activate this membership application.",
          },
          { status: expectedValidation ? 409 : 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        activation: activationResult.data,
      });
    }

    if (action !== "create_application") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const kind = clean(body.kind).toLowerCase();
    const requiredPermission = kind === "renewal" ? "members.renew" : "members.create";
    const auth = await requireSystemPermission(request, requiredPermission);
    if (auth.error || !auth.context) return auth.error;

    if (kind !== "new" && kind !== "renewal") {
      return NextResponse.json(
        { error: "Membership must be NEW MEMBERSHIP or RENEWAL." },
        { status: 400 }
      );
    }

    let staffName: string;
    try {
      staffName = requireStaffName(body.staffName);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Staff Name is required." },
        { status: 400 }
      );
    }

    const membershipType = clean(body.membershipType).toLowerCase();
    const durationKey = clean(body.durationKey).toLowerCase();
    const startDate = clean(body.startDate);
    const expiryDate = clean(body.expiryDate);

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

    const rawParticipants: any[] = Array.isArray(body.participants)
      ? body.participants
      : [];
    const expectedParticipants = membershipType === "couples" ? 2 : 1;
    if (rawParticipants.length !== expectedParticipants) {
      return NextResponse.json(
        {
          error:
            membershipType === "couples"
              ? "Couples membership requires exactly two participants."
              : "This membership requires exactly one participant.",
        },
        { status: 400 }
      );
    }

    let participants: ReturnType<typeof participantPayload>[];
    try {
      participants = rawParticipants.map((participant, index) =>
        participantPayload(participant, index + 1, kind)
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid participant details." },
        { status: 400 }
      );
    }

    const renewalMemberIds = participants
      .map((participant) => participant.existing_member_id)
      .filter((value): value is string => Boolean(value));

    if (kind === "renewal" && new Set(renewalMemberIds).size !== renewalMemberIds.length) {
      return NextResponse.json(
        { error: "A renewal cannot use the same existing member twice." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const gym = await resolveEnrollmentGym(
      supabase,
      auth.context,
      clean(body.enrollmentGymId)
    );

    if (kind === "renewal") {
      const memberResult = await supabase
        .from("bgm_members")
        .select("id")
        .in("id", renewalMemberIds);

      if (memberResult.error) throw memberResult.error;
      if ((memberResult.data || []).length !== renewalMemberIds.length) {
        return NextResponse.json(
          { error: "One or more renewal members could not be confirmed." },
          { status: 404 }
        );
      }
    }

    const applicationReference = makeApplicationReference();
    const now = new Date().toISOString();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .insert({
        application_reference: applicationReference,
        application_kind: kind,
        membership_type: membershipType,
        duration_key: durationKey,
        start_date: startDate,
        expiry_date: expiryDate,
        enrollment_gym_id: gym.id,
        staff_name: staffName,
        status: "awaiting_payment",
        submitted_by_system_user_id: auth.context.systemUserId,
        submitted_at: now,
        updated_at: now,
      })
      .select("id, application_reference, status")
      .single();

    if (applicationResult.error) throw applicationResult.error;

    const applicationId = applicationResult.data.id;
    const participantResult = await supabase
      .from("bgm_membership_application_members")
      .insert(
        participants.map((participant) => ({
          application_id: applicationId,
          ...participant,
        }))
      );

    if (participantResult.error) {
      await supabase
        .from("bgm_membership_applications")
        .delete()
        .eq("id", applicationId);
      throw participantResult.error;
    }

    const primaryExistingMemberId = participants[0]?.existing_member_id || null;
    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: gym.id,
      staff_name: staffName,
      action_key: "membership.application.submit",
      entity_type: "membership_application",
      entity_id: applicationId,
      member_id: primaryExistingMemberId,
      after_data: {
        applicationKind: kind,
        membershipType,
        durationKey,
        startDate,
        expiryDate,
        applicationReference,
      },
    });

    if (auditResult.error) {
      console.error(auditResult.error);
    }

    return NextResponse.json({
      ok: true,
      application: {
        id: applicationId,
        reference: applicationResult.data.application_reference,
        status: applicationResult.data.status,
        kind,
        membershipType,
        durationKey,
        startDate,
        expiryDate,
        enrollmentGym: { id: gym.id, name: gym.name },
        staffName,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not process the membership application." },
      { status: 500 }
    );
  }
}
