import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildEnrollmentIdentityAction,
  requireStaffName,
} from "@/lib/membershipEnrollmentCore";
import { isUnder18On, isUnder16On } from "@/lib/membershipRegistrationCore";
import { UNDER16_SUPERVISION_CLAUSE } from "@/lib/guardianConsentPolicy";
import { pendingGuardianConsentGap } from "@/lib/guardianConsentSafety";
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

function addOneDayIso(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function maltaTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function makeApplicationReference() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
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
    town: optional(participant?.town),
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

      let staffName: string;
      try {
        staffName = requireStaffName(body.staffName, "Payment Staff Name");
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Payment Staff Name is required." },
          { status: 400 }
        );
      }

      const paymentMethod = clean(body.paymentMethod).toLowerCase();
      const paymentOtherText = clean(body.paymentOtherText);
      const discountCode = clean(body.discountCode).toUpperCase();

      if (!["cash", "card", "other"].includes(paymentMethod)) {
        return NextResponse.json(
          { error: "Select Cash, Card or Other as the payment method." },
          { status: 400 }
        );
      }
      if (paymentMethod === "other" && !paymentOtherText) {
        return NextResponse.json(
          { error: "Describe the Other payment method." },
          { status: 400 }
        );
      }

      const supabase = getSupabaseAdmin();
      const applicationResult = await supabase
        .from("bgm_membership_applications")
        .select("id, enrollment_gym_id, status, application_source, reviewed_by_system_user_id, submitted_at, declaration_snapshot")
        .eq("id", applicationId)
        .maybeSingle();
      if (applicationResult.error) throw applicationResult.error;
      if (!applicationResult.data) {
        return NextResponse.json(
          { error: "Membership application not found." },
          { status: 404 }
        );
      }
      if (
        !auth.context.isSuperAdmin &&
        auth.context.gymId !== applicationResult.data.enrollment_gym_id
      ) {
        return NextResponse.json(
          { error: "This application belongs to another gym." },
          { status: 403 }
        );
      }

      if (
        applicationResult.data.application_source === "tablet" &&
        !applicationResult.data.reviewed_by_system_user_id
      ) {
        return NextResponse.json(
          { error: "Staff must confirm the online application review before payment and activation." },
          { status: 409 }
        );
      }

      // Check DOB and the immutable consent snapshot again at activation. The
      // printed flag and the legacy under_18_at_submission flag alone are unsafe.
      const guardianParticipantsResult = await supabase
        .from("bgm_membership_application_members")
        .select("participant_order, date_of_birth, under_18_at_submission, existing_member_id, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address, guardian_present_verified_at, guardian_cosign_verified_at")
        .eq("application_id", applicationId);
      if (guardianParticipantsResult.error) throw guardianParticipantsResult.error;
      const guardianParticipants = guardianParticipantsResult.data || [];
      const existingIds = guardianParticipants.map(p => p.existing_member_id).filter((id): id is string => Boolean(id));
      if (existingIds.length) {
        const membersResult = await supabase.from("bgm_members").select("id,date_of_birth").in("id", existingIds);
        if (membersResult.error) throw membersResult.error;
        if ((membersResult.data || []).length !== new Set(existingIds).size) {
          return NextResponse.json({ error: "Existing member date of birth could not be verified." }, { status: 409 });
        }
        const dates = new Map((membersResult.data || []).map(m => [m.id, m.date_of_birth]));
        for (const participant of guardianParticipants) {
          if (participant.existing_member_id) {
            const actualBirth = dates.get(participant.existing_member_id);
            if (!actualBirth) {
              return NextResponse.json({ error: "Existing member date of birth must be verified before activation." }, { status: 409 });
            }
            participant.date_of_birth = actualBirth;
          }
        }
      }
      const guardianGap = pendingGuardianConsentGap(
        applicationResult.data.submitted_at,
        applicationResult.data.declaration_snapshot,
        guardianParticipants,
        true,
      );
      if (guardianGap) return NextResponse.json({ error: guardianGap }, { status: 409 });

      const printConfirmationResult = await supabase
        .from("bgm_audit_log")
        .select("id")
        .eq("entity_type", "membership_application")
        .eq("entity_id", applicationId)
        .eq("action_key", "membership.application.print_confirmed")
        .limit(1)
        .maybeSingle();

      if (printConfirmationResult.error) throw printConfirmationResult.error;
      if (!printConfirmationResult.data) {
        return NextResponse.json(
          { error: "Print and confirm the membership form before taking payment." },
          { status: 409 }
        );
      }

      const activationResult = await supabase.rpc(
        "bgm_activate_membership_application",
        {
          p_application_id: applicationId,
          p_payment_method: paymentMethod,
          p_payment_other_text: paymentMethod === "other" ? paymentOtherText : null,
          p_payment_staff_name: staffName,
          p_discount_code: discountCode || null,
          p_system_user_id: auth.context.systemUserId,
        }
      );

      if (activationResult.error) {
        console.error(activationResult.error);
        const message = String(activationResult.error.message || "");
        const expectedValidation =
          /required|not found|not awaiting activation|invalid participant|cannot reuse|existing member identity|existing renewal member|existing matched member is active|discount code|price snapshot|payment method|other payment/i.test(
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

      await broadcastStaffMembershipRefresh(
        applicationResult.data.enrollment_gym_id
      );

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

    const submittedOnMalta = maltaTodayIso();
    try {
      for (const participant of participants) {
        if (!participant.date_of_birth) {
          return NextResponse.json({ error: "Date of birth is required to verify membership eligibility." }, { status: 400 });
        }
        if (membershipType === "couples" && isUnder18On(participant.date_of_birth, submittedOnMalta)) {
          return NextResponse.json({ error: "Couples memberships require two adults aged at least 18." }, { status: 409 });
        }
      }
    } catch {
      return NextResponse.json({ error: "A valid date of birth is required." }, { status: 400 });
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
        .select("id, status, membership_expiry, date_of_birth")
        .in("id", renewalMemberIds);

      if (memberResult.error) throw memberResult.error;
      if ((memberResult.data || []).length !== renewalMemberIds.length) {
        return NextResponse.json(
          { error: "One or more renewal members could not be confirmed." },
          { status: 404 }
        );
      }

      // Reject edited DOBs; the permanent member record controls guardian eligibility.
      for (const member of memberResult.data || []) {
        if (!member.date_of_birth) {
          return NextResponse.json({ error: "Existing member date of birth must be verified before renewal." }, { status: 409 });
        }
        const corresponding = participants.find(p => p.existing_member_id === member.id);
        if (!corresponding || corresponding.date_of_birth !== member.date_of_birth) {
          return NextResponse.json({ error: "Renewal date of birth differs from the existing permanent member record. Reopen the member search." }, { status: 409 });
        }
        try {
          if (membershipType === "couples" && isUnder18On(member.date_of_birth, submittedOnMalta)) {
            return NextResponse.json({ error: "Couples membership requires both existing members to be at least 18." }, { status: 409 });
          }
        } catch {
          return NextResponse.json({ error: "Existing member date of birth must be corrected before renewal." }, { status: 409 });
        }
      }

      const today = maltaTodayIso();
      const activeExpiries = (memberResult.data || [])
        .filter(
          (member) =>
            member.status === "active" &&
            Boolean(member.membership_expiry) &&
            member.membership_expiry >= today
        )
        .map((member) => String(member.membership_expiry))
        .sort();

      const latestActiveExpiry = activeExpiries.at(-1);
      if (latestActiveExpiry) {
        const requiredStartDate = addOneDayIso(latestActiveExpiry);
        if (startDate !== requiredStartDate) {
          return NextResponse.json(
            {
              error: `This renewal must start on ${requiredStartDate}, the day after the current active membership expires.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const under18Orders: number[] = [];
    const under16Orders: number[] = [];
    try {
      for (const participant of participants) {
        if (isUnder18On(participant.date_of_birth!, submittedOnMalta)) under18Orders.push(participant.participant_order);
        if (isUnder16On(participant.date_of_birth!, submittedOnMalta)) under16Orders.push(participant.participant_order);
      }
    } catch {
      return NextResponse.json({ error: "A valid date of birth is required for guardian eligibility." }, { status: 400 });
    }

    let guardianSnapshot: Record<string, unknown> | null = null;
    if (under18Orders.length) {
      const guardianResult = await supabase
        .from("bgm_membership_declaration_versions")
        .select("id,version_no,body,content_sha256")
        .eq("content_key","guardian")
        .eq("status","published")
        .maybeSingle();
      if (guardianResult.error) throw guardianResult.error;
      const published = guardianResult.data;
      if (!published?.body || clean(body.guardianDeclarationVersionId) !== published.id) {
        return NextResponse.json({ error: "The published guardian declaration changed or is unavailable. Refresh the enrollment screen and ask the guardian to review the latest wording." }, { status: 409 });
      }
      guardianSnapshot = {
        guardian: {
          id: published.id, versionNo: Number(published.version_no),
          body: published.body, contentSha256: published.content_sha256,
          supervisionUnder16Orders: under16Orders,
          supervisionUnder16Text: UNDER16_SUPERVISION_CLAUSE,
        },
      };
    }

    for (const [index, participant] of participants.entries()) {
      Object.assign(participant, { under_18_at_submission: under18Orders.includes(index + 1) });
      if (!under18Orders.includes(index + 1)) continue;
      const guardian = rawParticipants[index]?.guardian || {};
      if (rawParticipants[index]?.guardianDeclarationPresented !== true) {
        return NextResponse.json({ error: `Applicant ${index + 1}: The guardian must review the published declaration before submission.` }, { status: 409 });
      }
      const details = {
        guardian_name: optional(guardian.fullName),
        guardian_id_number: optional(guardian.idNumber),
        guardian_relationship: optional(guardian.relationship),
        guardian_phone: optional(guardian.mobile),
        guardian_email: optional(guardian.email),
        guardian_address: optional(guardian.address),
      };
      if (Object.values(details).some(value => !value)) {
        return NextResponse.json({ error: `Applicant ${index + 1}: Complete parent or legal guardian details are required.` }, { status: 400 });
      }
      Object.assign(participant, details);
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
        submitted_on_malta: submittedOnMalta,
        application_source: "staff",
        declaration_snapshot: guardianSnapshot,
        document_readiness_ack_at: now,
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

      const participantMessage = String(participantResult.error.message || "");
      const expectedParticipantValidation =
        /active membership already exists|selected renewal member|renewal requires an existing member|identity/i.test(
          participantMessage
        );

      if (expectedParticipantValidation) {
        return NextResponse.json(
          { error: participantMessage },
          { status: 409 }
        );
      }

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
        applicationReference,
        applicationKind: kind,
        membershipType,
        durationKey,
        startDate,
        expiryDate,
        enrollmentGymId: gym.id,
        submittedAt: now,
        participants: participants.map((participant) => ({
          participantOrder: participant.participant_order,
          firstName: participant.first_name,
          lastName: participant.last_name,
          addressLine1: participant.address_line_1,
          addressLine2: participant.address_line_2,
          town: participant.town,
          postcode: participant.postcode,
          idNumber: participant.id_number,
          dateOfBirth: participant.date_of_birth,
          phone: participant.phone,
          email: participant.email,
          nextOfKin: participant.next_of_kin,
          officialPhotoPath: participant.official_photo_path,
          existingMemberId: participant.existing_member_id,
        })),
      },
    });

    if (auditResult.error) {
      console.error(auditResult.error);
    }

    await broadcastStaffMembershipRefresh(gym.id);

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
