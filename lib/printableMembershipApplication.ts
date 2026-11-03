import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type DeclarationPrintSnapshot = {
  id?: string;
  versionNo?: number | string;
  body?: string;
  contentSha256?: string;
  supervisionUnder16Orders?: number[];
  supervisionUnder16Text?: string;
};

export type PrintableParticipant = {
  id: string;
  participantOrder: number;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  memberId: string | null;
  memberNumber: string | null;
  barcode: string | null;
  photoUrl: string | null;
  under18AtSubmission: boolean;
  guardianName: string;
  guardianIdNumber: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  idVerified: boolean;
  studentEligibilityVerified: boolean;
  guardianPresentVerified: boolean;
  guardianCosignVerified: boolean;
};

export type PrintableApplication = {
  id: string;
  applicationReference: string;
  kind: string;
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  status: string;
  submittedAt: string | null;
  paymentReceivedAt: string | null;
  activatedAt: string | null;
  applicationStaffName: string | null;
  activationStaffName: string | null;
  enrollmentGymId: string;
  enrollmentGymName: string;
  accessScope: "network" | "single_gym";
  accessGymId: string | null;
  accessGymName: string | null;
  basePriceCents: number | null;
  currency: string;
  discountCode: string | null;
  discountPercentage: number | null;
  discountAmountCents: number | null;
  finalAmountCents: number | null;
  paymentMethod: string | null;
  paymentOtherText: string | null;
  paymentStaffName: string | null;
  declarationSnapshot: Record<string, DeclarationPrintSnapshot> | null;
  sameAddressVerified: boolean;
  participants: PrintableParticipant[];
};

function normalizedAccessScope(value: unknown): "network" | "single_gym" {
  return value === "single_gym" || value === "neptunes_only" ? "single_gym" : "network";
}

function accessDisplay(scope: "network" | "single_gym", gymName: string) {
  return scope === "single_gym" ? `Single Gym — ${gymName}` : "All Access";
}

export async function loadPrintableMembershipApplication(applicationId: string): Promise<PrintableApplication> {
  const supabase = getSupabaseAdmin();
  const applicationResult = await supabase
    .from("bgm_membership_applications")
    .select(
      "id, application_reference, application_kind, membership_type, duration_key, start_date, expiry_date, enrollment_gym_id, access_scope, access_gym_id, staff_name, status, submitted_at, payment_received_at, activated_at, base_price_cents, currency, discount_code_snapshot, discount_percentage_snapshot, discount_amount_cents, final_amount_cents, payment_method, payment_other_text, payment_staff_name, declaration_snapshot, same_address_verified_at"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationResult.error) throw applicationResult.error;
  const application = applicationResult.data;
  if (!application) throw new Error("Membership application not found.");

  const [participantsResult, gymResult, accessGymResult, membershipResult] = await Promise.all([
    supabase
      .from("bgm_membership_application_members")
      .select(
        "id, participant_order, first_name, last_name, address_line_1, address_line_2, town, postcode, id_number, date_of_birth, phone, email, next_of_kin, official_photo_path, existing_member_id, renewal_scanned_barcode, under_18_at_submission, guardian_name, guardian_id_number, guardian_relationship, guardian_phone, guardian_email, guardian_address, id_verified_at, student_eligibility_verified_at, guardian_present_verified_at, guardian_cosign_verified_at"
      )
      .eq("application_id", applicationId)
      .order("participant_order", { ascending: true }),
    supabase.from("bgm_gyms").select("id, name").eq("id", application.enrollment_gym_id).maybeSingle(),
    application.access_gym_id && application.access_gym_id !== application.enrollment_gym_id
      ? supabase.from("bgm_gyms").select("id, name").eq("id", application.access_gym_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("bgm_memberships")
      .select("id, activation_staff_name, activated_by_system_user_id, status")
      .eq("application_id", applicationId)
      .maybeSingle(),
  ]);
  if (participantsResult.error) throw participantsResult.error;
  if (gymResult.error) throw gymResult.error;
  if (accessGymResult.error) throw accessGymResult.error;
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
    return memberIdByRole.get(role) || participant.existing_member_id || null;
  });
  const allMemberIds = Array.from(new Set(resolvedMemberIds.filter((value): value is string => Boolean(value))));

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
      ? supabase.from("bgm_members").select("id, member_number, official_photo_path").in("id", allMemberIds)
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
  const memberById = new Map((membersResult.data || []).map((member) => [member.id, member]));

  const printableParticipants: PrintableParticipant[] = participants.map((participant, index) => {
    const memberId = resolvedMemberIds[index] || null;
    const member = memberId ? memberById.get(memberId) : null;
    const barcode =
      (memberId ? activeCardByMember.get(memberId) : null) ||
      reservedByParticipant.get(participant.id) ||
      participant.renewal_scanned_barcode ||
      null;
    const photoUrl = memberId && member?.official_photo_path
      ? `/api/system/members/photo/${encodeURIComponent(memberId)}?inline=1`
      : participant.official_photo_path
        ? `/api/system/members/photo?applicationMemberId=${encodeURIComponent(participant.id)}&inline=1`
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
      studentEligibilityVerified: Boolean(participant.student_eligibility_verified_at),
      guardianPresentVerified: Boolean(participant.guardian_present_verified_at),
      guardianCosignVerified: Boolean(participant.guardian_cosign_verified_at),
    };
  });

  const accessScope = normalizedAccessScope(application.access_scope);
  const enrollmentGymName = gymResult.data?.name || application.enrollment_gym_id;
  const accessGymName = accessScope === "single_gym"
    ? accessGymResult.data?.name ||
      (application.access_gym_id === application.enrollment_gym_id ? enrollmentGymName : application.access_gym_id) ||
      enrollmentGymName
    : "";
  const visibleGymAndAccess = `${enrollmentGymName} · Access: ${accessDisplay(accessScope, accessGymName)}`;

  return {
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
    enrollmentGymName: visibleGymAndAccess,
    accessScope,
    accessGymId: accessScope === "single_gym" ? application.access_gym_id : null,
    accessGymName: accessScope === "single_gym" ? accessGymName : null,
    basePriceCents: application.base_price_cents,
    currency: application.currency || "EUR",
    discountCode: application.discount_code_snapshot,
    discountPercentage: application.discount_percentage_snapshot,
    discountAmountCents: application.discount_amount_cents,
    finalAmountCents: application.final_amount_cents ?? application.base_price_cents,
    paymentMethod: application.payment_method,
    paymentOtherText: application.payment_other_text,
    paymentStaffName: application.payment_staff_name,
    declarationSnapshot:
      application.declaration_snapshot && typeof application.declaration_snapshot === "object"
        ? (application.declaration_snapshot as Record<string, DeclarationPrintSnapshot>)
        : null,
    sameAddressVerified: Boolean(application.same_address_verified_at),
    participants: printableParticipants,
  };
}
