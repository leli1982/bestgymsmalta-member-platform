import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { addMembershipDurationDate, todayMaltaDate } from "@/lib/maltaDate";
import {
  isUnder18On,
  normalizeIdentityDocument,
  participantCountForType,
  validateRegistrationParticipant,
} from "@/lib/membershipRegistrationCore";
import type {
  IdentityMatchState,
  PublicEnrollmentConfig,
  PublishedDeclarationSnapshot,
  RegistrationParticipant,
} from "@/lib/membershipRegistrationTypes";
import {
  validatePriceMatrix,
  type MembershipDurationKey,
  type MembershipType,
} from "@/lib/membershipSettingsCore";
import { broadcastStaffMembershipRefresh } from "@/lib/staffRealtime";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MEMBERSHIP_TYPES: readonly MembershipType[] = ["single", "student", "couples"];
const DURATION_KEYS: readonly MembershipDurationKey[] = [
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];
const DECLARATION_KEYS = ["gym_rules", "privacy", "health", "guardian"] as const;

type JsonRecord = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;
type SystemAuthContext = NonNullable<Awaited<ReturnType<typeof requireSystemPermission>>["context"]>;
type DeclarationRow = {
  id: string;
  content_key: string;
  version_no: number;
  body: string;
  content_sha256: string;
  status: string;
};
type GymRow = {
  id: string;
  name: string;
  short_name: string | null;
  public_enrollment_slug: string | null;
  status: string;
};

type ServerParticipant = {
  participant: RegistrationParticipant;
  under18AtSubmission: boolean;
  identityMatchState: IdentityMatchState;
  matchedMemberId: string | null;
  duplicateContactWarning: boolean;
  gymRulesAccepted: boolean;
  privacyAccepted: boolean;
  healthAccepted: boolean;
};

class RouteError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isMembershipType(value: string): value is MembershipType {
  return MEMBERSHIP_TYPES.includes(value as MembershipType);
}

function isDurationKey(value: string): value is MembershipDurationKey {
  return DURATION_KEYS.includes(value as MembershipDurationKey);
}

function isIdentityState(value: unknown): value is IdentityMatchState {
  return value === "clear" || value === "active" || value === "expired_inactive";
}

function sanitizeParticipant(value: unknown): RegistrationParticipant {
  const raw = asRecord(value);
  const guardianRaw = asRecord(raw.guardian);
  const hasGuardian = Object.keys(guardianRaw).length > 0;

  return {
    firstName: clean(raw.firstName),
    lastName: clean(raw.lastName),
    idNumber: clean(raw.idNumber),
    dateOfBirth: clean(raw.dateOfBirth),
    addressLine1: clean(raw.addressLine1),
    addressLine2: clean(raw.addressLine2),
    town: clean(raw.town),
    postcode: clean(raw.postcode),
    phone: clean(raw.phone),
    email: clean(raw.email).toLowerCase(),
    nextOfKin: clean(raw.nextOfKin),
    ...(hasGuardian
      ? {
          guardian: {
            fullName: clean(guardianRaw.fullName),
            idNumber: clean(guardianRaw.idNumber),
            relationship: clean(guardianRaw.relationship),
            mobile: clean(guardianRaw.mobile),
            email: clean(guardianRaw.email).toLowerCase(),
            address: clean(guardianRaw.address),
          },
        }
      : {}),
  };
}

function declarationAcceptance(value: unknown) {
  const raw = asRecord(value);
  return {
    gymRules: raw.gymRules === true,
    privacy: raw.privacy === true,
    health: raw.health === true,
  };
}

function declarationSnapshot(row: DeclarationRow): PublishedDeclarationSnapshot {
  return {
    id: row.id,
    contentKey: row.content_key as PublishedDeclarationSnapshot["contentKey"],
    versionNo: Number(row.version_no),
    body: row.body,
    contentSha256: row.content_sha256,
  };
}

function applicationDeclarationSnapshot(rows: {
  gymRules: DeclarationRow;
  privacy: DeclarationRow;
  health: DeclarationRow;
  guardian?: DeclarationRow;
}) {
  return {
    gymRules: {
      id: rows.gymRules.id,
      versionNo: Number(rows.gymRules.version_no),
      body: rows.gymRules.body,
      contentSha256: rows.gymRules.content_sha256,
    },
    privacy: {
      id: rows.privacy.id,
      versionNo: Number(rows.privacy.version_no),
      body: rows.privacy.body,
      contentSha256: rows.privacy.content_sha256,
    },
    health: {
      id: rows.health.id,
      versionNo: Number(rows.health.version_no),
      body: rows.health.body,
      contentSha256: rows.health.content_sha256,
    },
    ...(rows.guardian
      ? {
          guardian: {
            id: rows.guardian.id,
            versionNo: Number(rows.guardian.version_no),
            body: rows.guardian.body,
            contentSha256: rows.guardian.content_sha256,
          },
        }
      : {}),
  };
}

async function resolveGym(
  supabase: SupabaseAdmin,
  auth: SystemAuthContext,
  requestedGymId?: string,
): Promise<GymRow> {
  const requested = clean(requestedGymId);
  if (!auth.isSuperAdmin && requested && requested !== auth.gymId) {
    throw new RouteError(403, "You can only create memberships for your assigned gym.");
  }

  const gymId = auth.gymId || requested;
  if (!gymId) {
    throw new RouteError(400, "Choose an enrollment gym.");
  }

  const gymResult = await supabase
    .from("bgm_gyms")
    .select("id,name,short_name,public_enrollment_slug,status")
    .eq("id", gymId)
    .maybeSingle();
  if (gymResult.error) throw gymResult.error;
  if (!gymResult.data || gymResult.data.status !== "active") {
    throw new RouteError(404, "Active enrollment gym not found.");
  }
  return gymResult.data as GymRow;
}

async function loadCurrentSettings(supabase: SupabaseAdmin, gym: GymRow) {
  const catalogResult = await supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id,version_no,status")
    .eq("status", "published")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (catalogResult.error) throw catalogResult.error;
  if (!catalogResult.data) throw new RouteError(503, "Membership registration is not ready.");

  const [priceResult, declarationResult] = await Promise.all([
    supabase
      .from("bgm_membership_price_entries")
      .select("membership_type,duration_key,amount_cents,currency")
      .eq("catalog_version_id", catalogResult.data.id),
    supabase
      .from("bgm_membership_declaration_versions")
      .select("id,content_key,version_no,body,content_sha256,status")
      .eq("status", "published")
      .in("content_key", [...DECLARATION_KEYS])
      .order("version_no", { ascending: false }),
  ]);
  if (priceResult.error) throw priceResult.error;
  if (declarationResult.error) throw declarationResult.error;

  const entries = (priceResult.data || []).map((row) => ({
    membershipType: row.membership_type as MembershipType,
    durationKey: row.duration_key as MembershipDurationKey,
    amountCents: Number(row.amount_cents),
    currency: row.currency as "EUR",
  }));
  const priceValidation = validatePriceMatrix(entries);
  if (!priceValidation.ok) {
    throw new RouteError(503, "Membership registration pricing is not ready.");
  }

  const declarationByKey = new Map<string, DeclarationRow>();
  for (const row of (declarationResult.data || []) as DeclarationRow[]) {
    if (!declarationByKey.has(row.content_key)) declarationByKey.set(row.content_key, row);
  }

  const gymRules = declarationByKey.get("gym_rules");
  const privacy = declarationByKey.get("privacy");
  const health = declarationByKey.get("health");
  const guardian = declarationByKey.get("guardian");
  if (!gymRules || !privacy || !health) {
    throw new RouteError(503, "Membership registration declarations are not ready.");
  }

  const config: PublicEnrollmentConfig = {
    gym: {
      id: gym.id,
      name: gym.name,
      shortName: gym.short_name || gym.name,
      slug: gym.public_enrollment_slug || gym.id,
    },
    pricing: {
      versionId: catalogResult.data.id,
      entries,
    },
    declarations: {
      gymRules: declarationSnapshot(gymRules),
      privacy: declarationSnapshot(privacy),
      health: declarationSnapshot(health),
      ...(guardian ? { guardian: declarationSnapshot(guardian) } : {}),
    },
  };

  return {
    config,
    catalogId: catalogResult.data.id as string,
    declarations: { gymRules, privacy, health, guardian },
  };
}

async function cleanupApplication(supabase: SupabaseAdmin, applicationId: string) {
  await supabase
    .from("bgm_membership_application_members")
    .delete()
    .eq("application_id", applicationId);
  await supabase
    .from("bgm_membership_applications")
    .delete()
    .eq("id", applicationId);
}

function routeErrorResponse(error: unknown) {
  if (error instanceof RouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Could not process the staff membership registration." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSystemPermission(request, "members.create");
    if (authResult.error || !authResult.context) return authResult.error;

    const supabase = getSupabaseAdmin();
    const gym = await resolveGym(
      supabase,
      authResult.context,
      request.nextUrl.searchParams.get("gymId") || undefined,
    );
    const settings = await loadCurrentSettings(supabase, gym);

    return NextResponse.json(
      {
        config: settings.config,
        systemUser: {
          id: authResult.context.systemUserId,
          gymId: authResult.context.gymId,
          username: authResult.context.username,
          displayName: authResult.context.displayName,
          isSuperAdmin: authResult.context.isSuperAdmin,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  let applicationId = "";
  let supabase: SupabaseAdmin | null = null;

  try {
    const authResult = await requireSystemPermission(request, "members.create");
    if (authResult.error || !authResult.context) return authResult.error;

    const body = asRecord(await request.json());
    const draft = asRecord(body.draft);
    const membershipTypeValue = clean(draft.membershipType);
    const durationKeyValue = clean(draft.durationKey);
    if (
      !isMembershipType(membershipTypeValue) ||
      !isDurationKey(durationKeyValue) ||
      draft.documentReadinessAcknowledged !== true
    ) {
      throw new RouteError(400, "Membership registration details are incomplete.");
    }

    const membershipType = membershipTypeValue;
    const durationKey = durationKeyValue;
    const participantValues = Array.isArray(draft.participants) ? draft.participants : [];
    const declarationValues = Array.isArray(draft.declarations) ? draft.declarations : [];
    const expectedParticipantCount = participantCountForType(membershipType);
    if (
      participantValues.length !== expectedParticipantCount ||
      declarationValues.length !== expectedParticipantCount
    ) {
      throw new RouteError(400, "Participant count is invalid for this membership type.");
    }

    supabase = getSupabaseAdmin();
    const gym = await resolveGym(
      supabase,
      authResult.context,
      clean(body.enrollmentGymId),
    );
    const settings = await loadCurrentSettings(supabase, gym);
    const selectedPrice = settings.config.pricing.entries.find(
      (entry) =>
        entry.membershipType === membershipType && entry.durationKey === durationKey,
    );
    if (!selectedPrice) throw new RouteError(503, "Membership price is not available.");

    const submittedOnMalta = todayMaltaDate();
    const expiryDate = addMembershipDurationDate(submittedOnMalta, durationKey);
    const acceptances = declarationValues.map(declarationAcceptance);
    const serverParticipants: ServerParticipant[] = [];

    for (let index = 0; index < expectedParticipantCount; index += 1) {
      const participant = sanitizeParticipant(participantValues[index]);
      const validationErrors = validateRegistrationParticipant(participant, submittedOnMalta);
      const acceptance = acceptances[index];
      if (validationErrors.length > 0) {
        throw new RouteError(400, `Applicant ${index + 1}: ${validationErrors[0]}`);
      }
      if (!acceptance.gymRules || !acceptance.privacy || !acceptance.health) {
        throw new RouteError(400, `Applicant ${index + 1} must accept all required declarations.`);
      }

      const under18AtSubmission = isUnder18On(participant.dateOfBirth, submittedOnMalta);
      if (under18AtSubmission && !settings.declarations.guardian) {
        throw new RouteError(503, "The guardian declaration is not published.");
      }

      const identityResult = await supabase.rpc("bgm_classify_membership_identity", {
        p_id_number: normalizeIdentityDocument(participant.idNumber),
      });
      if (identityResult.error) throw identityResult.error;
      const identity = asRecord(identityResult.data);
      const state = identity.state;
      if (!isIdentityState(state)) {
        throw new RouteError(503, "Could not classify the applicant identity.");
      }
      if (state === "active") {
        throw new RouteError(
          409,
          `Applicant ${index + 1} already has an active membership. Use the existing member record instead.`,
        );
      }

      const contactResult = await supabase.rpc("bgm_has_membership_contact_match", {
        p_phone: participant.phone,
        p_email: participant.email,
      });
      if (contactResult.error) throw contactResult.error;

      serverParticipants.push({
        participant,
        under18AtSubmission,
        identityMatchState: state,
        matchedMemberId:
          typeof identity.matchedMemberId === "string" ? identity.matchedMemberId : null,
        duplicateContactWarning: contactResult.data === true,
        gymRulesAccepted: acceptance.gymRules,
        privacyAccepted: acceptance.privacy,
        healthAccepted: acceptance.health,
      });
    }

    applicationId = randomUUID();
    const participantIds = serverParticipants.map(() => randomUUID());
    const now = new Date().toISOString();
    const applicationReference = `BGMAPP-${applicationId.replaceAll("-", "").toUpperCase()}`;
    const staffName = clean(authResult.context.displayName) || clean(authResult.context.username);
    if (!staffName) throw new RouteError(400, "Staff name is required.");

    const applicationInsert = await supabase
      .from("bgm_membership_applications")
      .insert({
        id: applicationId,
        application_reference: applicationReference,
        membership_type: membershipType,
        duration_key: durationKey,
        enrollment_gym_id: gym.id,
        staff_name: staffName,
        application_kind: "new",
        start_date: submittedOnMalta,
        expiry_date: expiryDate,
        status: "submitted",
        submitted_by_system_user_id: authResult.context.systemUserId,
        submitted_at: now,
        application_source: "staff",
        submitted_on_malta: submittedOnMalta,
        base_price_cents: selectedPrice.amountCents,
        currency: "EUR",
        price_catalog_version_id: settings.catalogId,
        gym_rules_version_id: settings.declarations.gymRules.id,
        privacy_version_id: settings.declarations.privacy.id,
        health_version_id: settings.declarations.health.id,
        declaration_snapshot: applicationDeclarationSnapshot(settings.declarations),
        document_readiness_ack_at: now,
        updated_at: now,
      })
      .select("id,application_reference,status")
      .single();
    if (applicationInsert.error) throw applicationInsert.error;

    const participantRows = serverParticipants.map((serverParticipant, index) => ({
      id: participantIds[index],
      application_id: applicationId,
      participant_order: index + 1,
      first_name: serverParticipant.participant.firstName,
      last_name: serverParticipant.participant.lastName,
      address_line_1: serverParticipant.participant.addressLine1,
      address_line_2: serverParticipant.participant.addressLine2 || null,
      town: serverParticipant.participant.town,
      postcode: serverParticipant.participant.postcode || null,
      id_number: serverParticipant.participant.idNumber,
      date_of_birth: serverParticipant.participant.dateOfBirth,
      phone: serverParticipant.participant.phone,
      email: serverParticipant.participant.email,
      next_of_kin: serverParticipant.participant.nextOfKin,
      official_photo_path: null,
      existing_member_id: null,
      guardian_name: serverParticipant.participant.guardian?.fullName || null,
      guardian_id_number: serverParticipant.participant.guardian?.idNumber || null,
      guardian_relationship: serverParticipant.participant.guardian?.relationship || null,
      guardian_phone: serverParticipant.participant.guardian?.mobile || null,
      guardian_email: serverParticipant.participant.guardian?.email || null,
      guardian_address: serverParticipant.participant.guardian?.address || null,
      under_18_at_submission: serverParticipant.under18AtSubmission,
      identity_match_state: serverParticipant.identityMatchState,
      matched_member_id: serverParticipant.matchedMemberId,
      duplicate_contact_warning: serverParticipant.duplicateContactWarning,
      gym_rules_accepted_at: serverParticipant.gymRulesAccepted ? now : null,
      privacy_accepted_at: serverParticipant.privacyAccepted ? now : null,
      health_accepted_at: serverParticipant.healthAccepted ? now : null,
      updated_at: now,
    }));

    const participantInsert = await supabase
      .from("bgm_membership_application_members")
      .insert(participantRows);
    if (participantInsert.error) {
      await cleanupApplication(supabase, applicationId);
      throw participantInsert.error;
    }

    const auditResult = await supabase.from("bgm_audit_log").insert({
      system_user_id: authResult.context.systemUserId,
      context_gym_id: gym.id,
      staff_name: staffName,
      action_key: "membership.application.submit",
      entity_type: "membership_application",
      entity_id: applicationId,
      member_id: null,
      after_data: {
        applicationReference,
        applicationKind: "new",
        applicationSource: "staff",
        membershipType,
        durationKey,
        startDate: submittedOnMalta,
        expiryDate,
        basePriceCents: selectedPrice.amountCents,
        priceCatalogVersionId: settings.catalogId,
        participants: serverParticipants.map((serverParticipant, index) => ({
          applicationMemberId: participantIds[index],
          participantOrder: index + 1,
          firstName: serverParticipant.participant.firstName,
          lastName: serverParticipant.participant.lastName,
          idNumber: serverParticipant.participant.idNumber,
          identityMatchState: serverParticipant.identityMatchState,
          matchedMemberId: serverParticipant.matchedMemberId,
          duplicateContactWarning: serverParticipant.duplicateContactWarning,
          photoRequired: false,
        })),
      },
    });
    if (auditResult.error) {
      await cleanupApplication(supabase, applicationId);
      throw auditResult.error;
    }

    try {
      await broadcastStaffMembershipRefresh(gym.id);
    } catch (broadcastError) {
      console.error("Could not broadcast staff membership refresh.", broadcastError);
    }

    return NextResponse.json(
      {
        ok: true,
        application: {
          id: applicationId,
          reference: applicationInsert.data.application_reference,
          status: applicationInsert.data.status,
          members: participantIds.map((id, index) => ({
            id,
            participantOrder: index + 1,
            identityMatchState: serverParticipants[index].identityMatchState,
            matchedMemberId: serverParticipants[index].matchedMemberId,
          })),
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (applicationId && supabase && !(error instanceof RouteError)) {
      // Best-effort cleanup for unexpected failures after the application row was created.
      await cleanupApplication(supabase, applicationId);
    }
    return routeErrorResponse(error);
  }
}
