import { NextRequest, NextResponse } from "next/server";
import { addMembershipDurationDate, todayMaltaDate } from "@/lib/maltaDate";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import {
  couplesAgeEligibilityError,
  isUnder18On,
  normalizeIdentityDocument,
  participantCountForType,
  validateRegistrationParticipant,
  withCouplesSharedAddress,
} from "@/lib/membershipRegistrationCore";
import { decideOfflineSyncOutcome, type OfflineSyncIdentityState } from "@/lib/offlineMembershipSyncCore";
import type { MembershipDurationKey, MembershipType } from "@/lib/membershipSettingsCore";
import { broadcastStaffMembershipRefresh } from "@/lib/staffRealtime";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHOTO_BUCKET = "bgm-member-photos";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMBERSHIP_TYPES: readonly MembershipType[] = ["single", "student", "couples"];
const DURATION_KEYS: readonly MembershipDurationKey[] = [
  "1_session",
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];

function isMembershipType(value: string): value is MembershipType {
  return MEMBERSHIP_TYPES.includes(value as MembershipType);
}

function isDurationKey(value: string): value is MembershipDurationKey {
  return DURATION_KEYS.includes(value as MembershipDurationKey);
}

type JsonRecord = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type PreparedParticipant = {
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
  guardianName: string;
  guardianIdNumber: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  under18AtSubmission: boolean;
  identityMatchState: OfflineSyncIdentityState;
  matchedMemberId: string | null;
  duplicateContactWarning: boolean;
  gymRulesAccepted: boolean;
  privacyAccepted: boolean;
  healthAccepted: boolean;
};

class SyncError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function booleanArray(value: unknown, length: number): boolean[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => raw[index] === true);
}

function declarationAcceptance(value: unknown) {
  const raw = asRecord(value);
  return {
    gymRules: raw.gymRules === true,
    privacy: raw.privacy === true,
    health: raw.health === true,
  };
}

function participantFromPayload(value: unknown) {
  const raw = asRecord(value);
  const guardian = asRecord(raw.guardian);
  const hasGuardian = Object.keys(guardian).length > 0;
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
    ...(hasGuardian ? {
      guardian: {
        fullName: clean(guardian.fullName),
        idNumber: clean(guardian.idNumber),
        relationship: clean(guardian.relationship),
        mobile: clean(guardian.mobile),
        email: clean(guardian.email).toLowerCase(),
        address: clean(guardian.address),
      },
    } : {}),
  };
}

function declarationSnapshot(config: JsonRecord, includeGuardian: boolean, under16Orders: number[]) {
  const declarations = asRecord(config.declarations);
  const snapshot = (value: unknown) => {
    const row = asRecord(value);
    return {
      id: clean(row.id),
      versionNo: Number(row.versionNo || 0),
      body: clean(row.body),
      contentSha256: clean(row.contentSha256),
    };
  };
  const result: JsonRecord = {
    gymRules: snapshot(declarations.gymRules),
    privacy: snapshot(declarations.privacy),
    health: snapshot(declarations.health),
  };
  if (includeGuardian) {
    result.guardian = {
      ...snapshot(declarations.guardian),
      supervisionUnder16Orders: under16Orders,
    };
  }
  return result;
}

async function loadExistingReceipt(supabase: SupabaseAdmin, clientSubmissionId: string) {
  const result = await supabase
    .from("bgm_offline_membership_sync_receipts")
    .select("source_gym_id,result_payload")
    .eq("client_submission_id", clientSubmissionId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function recordReceipt(
  supabase: SupabaseAdmin,
  input: {
    clientSubmissionId: string;
    sourceGymId: string;
    systemUserId: string;
    staffName: string;
    applicationId: string | null;
    result: "activated" | "review_required" | "rejected";
    resultPayload: JsonRecord;
    sourcePayload: JsonRecord;
  },
) {
  const receipt = await supabase.rpc("bgm_record_offline_membership_sync_receipt", {
    p_payload: {
      clientSubmissionId: input.clientSubmissionId,
      sourceGymId: input.sourceGymId,
      systemUserId: input.systemUserId,
      staffName: input.staffName,
      applicationId: input.applicationId,
      result: input.result,
      resultPayload: input.resultPayload,
      sourcePayload: input.sourcePayload,
    },
  });
  if (receipt.error) throw receipt.error;
  return asRecord(receipt.data);
}

function activationMembers(value: unknown) {
  const raw = asRecord(value);
  const members = Array.isArray(raw.members) ? raw.members : [];
  return members.map((member) => asRecord(member)).map((member) => ({
    memberId: clean(member.memberId),
    memberNumber: clean(member.memberNumber),
    cardBarcode: clean(member.cardBarcode),
  }));
}

async function recoverActivatedApplication(
  supabase: SupabaseAdmin,
  clientSubmissionId: string,
  gymId: string,
  systemUserId: string,
  staffName: string,
) {
  const application = await supabase
    .from("bgm_membership_applications")
    .select("id,status,application_source,enrollment_gym_id")
    .eq("id", clientSubmissionId)
    .maybeSingle();
  if (application.error) throw application.error;
  if (!application.data) return null;
  if (application.data.application_source !== "offline_staff" || application.data.enrollment_gym_id !== gymId) {
    throw new SyncError(409, "This offline reference belongs to a different server application.");
  }
  if (application.data.status !== "activated") return application.data;

  const recovered = await supabase.rpc("bgm_activate_membership_application", {
    p_application_id: clientSubmissionId,
    p_activation_staff_name: staffName,
    p_system_user_id: systemUserId,
  });
  if (recovered.error) throw recovered.error;
  const members = activationMembers(recovered.data);
  const resultPayload = {
    ok: true,
    persisted: true,
    clientSubmissionId,
    result: "activated",
    applicationId: clientSubmissionId,
    memberNumbers: members.map((member) => member.memberNumber).filter(Boolean),
    members,
    recovered: true,
  };
  return recordReceipt(supabase, {
    clientSubmissionId,
    sourceGymId: gymId,
    systemUserId,
    staffName,
    applicationId: clientSubmissionId,
    result: "activated",
    resultPayload,
    sourcePayload: {},
  });
}

async function verifyHistoricalConfig(
  supabase: SupabaseAdmin,
  record: JsonRecord,
  gymId: string,
  membershipType: string,
  durationKey: string,
  amountCents: number,
  needsGuardian: boolean,
) {
  const context = asRecord(record.cachedContext);
  const config = asRecord(context.config);
  const pricing = asRecord(config.pricing);
  const declarations = asRecord(config.declarations);
  if (clean(context.gymId) !== gymId || clean(asRecord(config.gym).id) !== gymId) {
    return { verified: false as const };
  }
  const catalogId = clean(pricing.versionId);
  const cachedAt = new Date(clean(context.cachedAt));
  if (!UUID_RE.test(catalogId) || Number.isNaN(cachedAt.getTime())) return { verified: false as const };

  const catalog = await supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id,status,published_at")
    .eq("id", catalogId)
    .maybeSingle();
  if (catalog.error) throw catalog.error;
  if (!catalog.data || !["published", "retired"].includes(String(catalog.data.status)) || !catalog.data.published_at || new Date(catalog.data.published_at) > cachedAt) {
    return { verified: false as const };
  }

  const price = await supabase
    .from("bgm_membership_price_entries")
    .select("amount_cents,currency,is_active")
    .eq("catalog_version_id", catalogId)
    .eq("membership_type", membershipType)
    .eq("duration_key", durationKey)
    .maybeSingle();
  if (price.error) throw price.error;
  if (!price.data || Number(price.data.amount_cents) !== amountCents || price.data.currency !== "EUR" || price.data.is_active !== true) {
    return { verified: false as const };
  }

  const wanted = [
    ["gym_rules", asRecord(declarations.gymRules)],
    ["privacy", asRecord(declarations.privacy)],
    ["health", asRecord(declarations.health)],
    ...(needsGuardian ? [["guardian", asRecord(declarations.guardian)] as const] : []),
  ] as const;
  const ids = wanted.map(([, value]) => clean(value.id));
  if (ids.some((id) => !UUID_RE.test(id))) return { verified: false as const };

  const declarationRows = await supabase
    .from("bgm_membership_declaration_versions")
    .select("id,content_key,content_sha256,status,published_at")
    .in("id", ids);
  if (declarationRows.error) throw declarationRows.error;
  const rows = new Map((declarationRows.data || []).map((row) => [String(row.id), row]));
  for (const [contentKey, cached] of wanted) {
    const id = clean(cached.id);
    const row = rows.get(id);
    if (
      !row ||
      row.content_key !== contentKey ||
      clean(row.content_sha256) !== clean(cached.contentSha256) ||
      !["published", "retired"].includes(String(row.status)) ||
      !row.published_at ||
      new Date(row.published_at) > cachedAt
    ) {
      return { verified: false as const };
    }
  }

  return {
    verified: true as const,
    catalogId,
    gymRulesVersionId: clean(asRecord(declarations.gymRules).id),
    privacyVersionId: clean(asRecord(declarations.privacy).id),
    healthVersionId: clean(asRecord(declarations.health).id),
    config,
  };
}

async function attachPhotos(
  supabase: SupabaseAdmin,
  form: FormData,
  clientSubmissionId: string,
  participantIds: string[],
  systemUserId: string,
  gymId: string,
  staffName: string,
) {
  for (let index = 0; index < participantIds.length; index += 1) {
    const value = form.get(`photo${index}`);
    if (!(value instanceof File) || value.size === 0) continue;
    if (value.type && value.type !== "image/webp") throw new SyncError(422, `Applicant ${index + 1}: offline photo must be WebP.`);
    if (value.size > 5 * 1024 * 1024) throw new SyncError(422, `Applicant ${index + 1}: offline photo is too large.`);

    const objectPath = `offline/${clientSubmissionId}/${index + 1}.webp`;
    const upload = await supabase.storage.from(PHOTO_BUCKET).upload(objectPath, value, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true,
    });
    if (upload.error) throw upload.error;

    const participantUpdate = await supabase
      .from("bgm_membership_application_members")
      .update({ official_photo_path: objectPath, updated_at: new Date().toISOString() })
      .eq("id", participantIds[index])
      .eq("application_id", clientSubmissionId);
    if (participantUpdate.error) throw participantUpdate.error;

    const provenance = await supabase
      .from("bgm_member_official_photos")
      .upsert({
        member_id: null,
        application_member_id: participantIds[index],
        object_path: objectPath,
        source: "new_membership",
        captured_at: new Date().toISOString(),
        system_user_id: systemUserId,
        gym_id: gymId,
        staff_name: staffName,
      }, { onConflict: "object_path" });
    if (provenance.error) throw provenance.error;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof SyncError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Could not synchronize the offline membership." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const form = await request.formData();
    const payloadText = form.get("payload");
    if (typeof payloadText !== "string") throw new SyncError(400, "Offline membership payload is required.");
    const record = asRecord(JSON.parse(payloadText));
    const clientSubmissionId = clean(record.clientSubmissionId);
    const gymId = clean(record.gymId);
    const soldAt = clean(record.soldAt);
    const payment = asRecord(record.payment);
    const registration = asRecord(record.registration);
    const context = asRecord(record.cachedContext);
    const cachedSystemUser = asRecord(context.systemUser);
    const membershipTypeValue = clean(registration.membershipType).toLowerCase();
    const durationKeyValue = clean(registration.durationKey).toLowerCase();
    const staffName = clean(payment.staffName) || clean(cachedSystemUser.displayName) || auth.context.displayName;
    const amountCents = Number(payment.amountCents);

    if (!UUID_RE.test(clientSubmissionId)) throw new SyncError(400, "Offline client submission ID is invalid.");
    if (!gymId || (!auth.context.isSuperAdmin && auth.context.gymId !== gymId)) throw new SyncError(403, "This offline sale belongs to another gym.");
    if (!isMembershipType(membershipTypeValue) || !isDurationKey(durationKeyValue) || registration.documentReadinessAcknowledged !== true) {
      throw new SyncError(400, "Offline registration details are incomplete.");
    }
    const membershipType = membershipTypeValue;
    const durationKey = durationKeyValue;
    if (!Number.isInteger(amountCents) || amountCents < 0 || payment.currency !== "EUR") throw new SyncError(400, "Offline payment snapshot is invalid.");
    if (Number.isNaN(new Date(soldAt).getTime())) throw new SyncError(400, "Offline sale time is invalid.");
    if (!["cash", "card", "other"].includes(clean(payment.method))) throw new SyncError(400, "Offline payment method is invalid.");
    if (clean(payment.method) === "other" && !clean(payment.otherText)) throw new SyncError(400, "Offline payment details are required.");

    const supabase = getSupabaseAdmin();
    const receipt = await loadExistingReceipt(supabase, clientSubmissionId);
    if (receipt) {
      if (receipt.source_gym_id !== gymId) throw new SyncError(409, "Offline receipt gym mismatch.");
      return NextResponse.json(receipt.result_payload, { headers: { "Cache-Control": "no-store" } });
    }

    const recovered = await recoverActivatedApplication(
      supabase,
      clientSubmissionId,
      gymId,
      auth.context.systemUserId,
      staffName,
    );
    if (recovered && asRecord(recovered).persisted === true) {
      return NextResponse.json(recovered, { headers: { "Cache-Control": "no-store" } });
    }

    const participantValues = Array.isArray(registration.participants) ? registration.participants : [];
    const declarationValues = Array.isArray(registration.declarations) ? registration.declarations : [];
    const expectedCount = participantCountForType(membershipType);
    if (participantValues.length !== expectedCount || declarationValues.length !== expectedCount) throw new SyncError(400, "Offline participant count is invalid.");

    const soldOnMalta = todayMaltaDate(new Date(soldAt));
    const expiryDate = addMembershipDurationDate(soldOnMalta, durationKey);
    const participants = withCouplesSharedAddress(
      membershipType,
      participantValues.map(participantFromPayload),
    );
    const acceptances = declarationValues.map(declarationAcceptance);
    const under18 = participants.map((participant) => isUnder18On(participant.dateOfBirth, soldOnMalta));
    const needsGuardian = under18.some(Boolean);

    for (let index = 0; index < participants.length; index += 1) {
      const errors = validateRegistrationParticipant(participants[index], soldOnMalta);
      if (errors.length) throw new SyncError(400, `Applicant ${index + 1}: ${errors[0]}`);
      const couplesError = couplesAgeEligibilityError(membershipType, participants[index].dateOfBirth, soldOnMalta);
      if (couplesError) throw new SyncError(400, `Applicant ${index + 1}: ${couplesError}`);
    }

    const configCheck = await verifyHistoricalConfig(supabase, record, gymId, membershipType, durationKey, amountCents, needsGuardian);
    const identityStates: OfflineSyncIdentityState[] = [];
    const preparedParticipants: PreparedParticipant[] = [];
    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index];
      const identity = await supabase.rpc("bgm_classify_membership_identity", {
        p_id_number: normalizeIdentityDocument(participant.idNumber),
      });
      if (identity.error) throw identity.error;
      const identityData = asRecord(identity.data);
      const state = clean(identityData.state) as OfflineSyncIdentityState;
      if (!["clear", "active", "expired_inactive"].includes(state)) throw new SyncError(500, "Could not classify offline applicant identity.");
      identityStates.push(state);

      const contact = await supabase.rpc("bgm_has_membership_contact_match", {
        p_phone: participant.phone,
        p_email: participant.email,
      });
      if (contact.error) throw contact.error;
      const acceptance = acceptances[index];
      preparedParticipants.push({
        firstName: participant.firstName,
        lastName: participant.lastName,
        addressLine1: participant.addressLine1,
        addressLine2: participant.addressLine2,
        town: participant.town,
        postcode: participant.postcode,
        idNumber: participant.idNumber,
        dateOfBirth: participant.dateOfBirth,
        phone: participant.phone,
        email: participant.email,
        nextOfKin: participant.nextOfKin,
        guardianName: participant.guardian?.fullName || "",
        guardianIdNumber: participant.guardian?.idNumber || "",
        guardianRelationship: participant.guardian?.relationship || "",
        guardianPhone: participant.guardian?.mobile || "",
        guardianEmail: participant.guardian?.email || "",
        guardianAddress: participant.guardian?.address || "",
        under18AtSubmission: under18[index],
        identityMatchState: state,
        matchedMemberId: typeof identityData.matchedMemberId === "string" ? identityData.matchedMemberId : null,
        duplicateContactWarning: contact.data === true,
        gymRulesAccepted: acceptance.gymRules,
        privacyAccepted: acceptance.privacy,
        healthAccepted: acceptance.health,
      });
    }

    const cards = Array.isArray(record.pendingCardValues) ? record.pendingCardValues.map((value) => normalizeBarcodePayload(String(value ?? ""))) : [];
    const cardsComplete = cards.length === expectedCount && cards.every(Boolean) && new Set(cards).size === cards.length;
    let cardConflict = !cardsComplete;
    if (cardsComplete) {
      const existingCards = await supabase
        .from("bgm_member_card_credentials")
        .select("barcode_value,application_member_id,status")
        .in("barcode_value", cards);
      if (existingCards.error) throw existingCards.error;
      const ownParticipantIds = new Set<string>();
      if (recovered && !asRecord(recovered).persisted) {
        const applicationMembers = await supabase
          .from("bgm_membership_application_members")
          .select("id")
          .eq("application_id", clientSubmissionId);
        if (applicationMembers.error) throw applicationMembers.error;
        for (const row of applicationMembers.data || []) ownParticipantIds.add(String(row.id));
      }
      cardConflict = (existingCards.data || []).some((row) => !(
        row.status === "reserved" && row.application_member_id && ownParticipantIds.has(String(row.application_member_id))
      ));
    }

    const verification = asRecord(record.verifications);
    const idVerified = booleanArray(verification.participantIdVerified, expectedCount);
    const studentVerified = booleanArray(verification.studentEligibilityVerified, expectedCount);
    const guardianPresent = booleanArray(verification.guardianPresentVerified, expectedCount);
    const guardianCosign = booleanArray(verification.guardianCosignVerified, expectedCount);
    const declarationsComplete = acceptances.every((item) => item.gymRules && item.privacy && item.health);
    const verificationComplete =
      declarationsComplete &&
      idVerified.every(Boolean) &&
      (membershipType !== "student" || studentVerified.every(Boolean)) &&
      (membershipType !== "couples" || verification.sameAddressVerified === true) &&
      under18.every((minor, index) => !minor || (guardianPresent[index] && guardianCosign[index]));

    let decision = decideOfflineSyncOutcome({
      configVerified: configCheck.verified,
      identityStates,
      cardConflict,
      verificationComplete,
    });

    if (!configCheck.verified) {
      const resultPayload = {
        ok: true,
        persisted: true,
        clientSubmissionId,
        result: "review_required",
        applicationId: null,
        reason: "stale_config",
      };
      const stored = await recordReceipt(supabase, {
        clientSubmissionId,
        sourceGymId: gymId,
        systemUserId: auth.context.systemUserId,
        staffName,
        applicationId: null,
        result: "review_required",
        resultPayload,
        sourcePayload: record,
      });
      return NextResponse.json(stored, { headers: { "Cache-Control": "no-store" } });
    }

    const under16Orders = participants.flatMap((participant, index) => {
      const age = new Date(`${participant.dateOfBirth}T00:00:00Z`);
      const start = new Date(`${soldOnMalta}T00:00:00Z`);
      let years = start.getUTCFullYear() - age.getUTCFullYear();
      const beforeBirthday = start.getUTCMonth() < age.getUTCMonth() || (start.getUTCMonth() === age.getUTCMonth() && start.getUTCDate() < age.getUTCDate());
      if (beforeBirthday) years -= 1;
      return years < 16 ? [index + 1] : [];
    });

    const stagePayload = {
      clientSubmissionId,
      systemUserId: auth.context.systemUserId,
      gymId,
      staffName,
      membershipType,
      durationKey,
      soldAt,
      soldOnMalta,
      expiryDate,
      basePriceCents: amountCents,
      priceCatalogVersionId: configCheck.catalogId,
      gymRulesVersionId: configCheck.gymRulesVersionId,
      privacyVersionId: configCheck.privacyVersionId,
      healthVersionId: configCheck.healthVersionId,
      declarationSnapshot: declarationSnapshot(configCheck.config, needsGuardian, under16Orders),
      participants: preparedParticipants,
      pendingCardValues: cards,
      reserveCards: decision.action === "activate",
    };

    let staged = await supabase.rpc("bgm_stage_offline_membership_application", { p_payload: stagePayload });
    if (staged.error && decision.action === "activate" && /card/i.test(staged.error.message || "")) {
      decision = { action: "review_required", reason: "card_conflict" };
      staged = await supabase.rpc("bgm_stage_offline_membership_application", {
        p_payload: { ...stagePayload, reserveCards: false },
      });
    }
    if (staged.error) throw staged.error;
    const stageData = asRecord(staged.data);
    const applicationId = clean(stageData.applicationId);
    const participantIds = Array.isArray(stageData.participantIds) ? stageData.participantIds.map(clean) : [];
    if (!UUID_RE.test(applicationId) || participantIds.length !== expectedCount) throw new SyncError(500, "Offline application staging returned an invalid result.");

    const reviewParticipants = participants.map((participant, index) => ({
      id: participantIds[index],
      firstName: participant.firstName,
      lastName: participant.lastName,
      addressLine1: participant.addressLine1,
      addressLine2: participant.addressLine2,
      town: participant.town,
      postcode: participant.postcode,
      idNumber: participant.idNumber,
      dateOfBirth: participant.dateOfBirth,
      phone: participant.phone,
      email: participant.email,
      nextOfKin: participant.nextOfKin,
      idVerified: idVerified[index],
      studentEligibilityVerified: studentVerified[index],
      guardianPresentVerified: guardianPresent[index],
      guardianCosignVerified: guardianCosign[index],
    }));
    const review = await supabase.rpc("bgm_apply_membership_application_review", {
      p_review: {
        applicationId,
        systemUserId: auth.context.systemUserId,
        membershipType,
        durationKey,
        startDate: soldOnMalta,
        expiryDate,
        participants: reviewParticipants,
        sameAddressVerified: verification.sameAddressVerified === true,
        paymentMethod: clean(payment.method),
        paymentOtherText: clean(payment.otherText),
        paymentStaffName: staffName,
        discountCode: "",
      },
    });
    if (review.error && !/no longer reviewable/i.test(review.error.message || "")) throw review.error;

    await attachPhotos(supabase, form, clientSubmissionId, participantIds, auth.context.systemUserId, gymId, staffName);

    if (decision.action === "review_required") {
      const resultPayload = {
        ok: true,
        persisted: true,
        clientSubmissionId,
        result: "review_required",
        applicationId,
        reason: decision.reason,
      };
      const stored = await recordReceipt(supabase, {
        clientSubmissionId,
        sourceGymId: gymId,
        systemUserId: auth.context.systemUserId,
        staffName,
        applicationId,
        result: "review_required",
        resultPayload,
        sourcePayload: record,
      });
      try { await broadcastStaffMembershipRefresh(gymId); } catch (error) { console.error("Offline review refresh failed.", error); }
      return NextResponse.json(stored, { headers: { "Cache-Control": "no-store" } });
    }

    const activation = await supabase.rpc("bgm_activate_offline_membership_application", {
      p_application_id: applicationId,
      p_activation_staff_name: staffName,
      p_system_user_id: auth.context.systemUserId,
    });
    if (activation.error) throw activation.error;
    const activationData = asRecord(activation.data);
    if (activationData.offlineIdentityConflict === true) {
      const reason = clean(activationData.reason) === "possible_renewal"
        ? "possible_renewal"
        : "active_identity";
      const resultPayload = {
        ok: true,
        persisted: true,
        clientSubmissionId,
        result: "review_required",
        applicationId,
        reason,
      };
      const stored = await recordReceipt(supabase, {
        clientSubmissionId,
        sourceGymId: gymId,
        systemUserId: auth.context.systemUserId,
        staffName,
        applicationId,
        result: "review_required",
        resultPayload,
        sourcePayload: record,
      });
      try { await broadcastStaffMembershipRefresh(gymId); } catch (error) { console.error("Offline identity-conflict refresh failed.", error); }
      return NextResponse.json(stored, { headers: { "Cache-Control": "no-store" } });
    }
    const members = activationMembers(activationData);
    const resultPayload = {
      ok: true,
      persisted: true,
      clientSubmissionId,
      result: "activated",
      applicationId,
      memberNumbers: members.map((member) => member.memberNumber).filter(Boolean),
      members,
    };
    const stored = await recordReceipt(supabase, {
      clientSubmissionId,
      sourceGymId: gymId,
      systemUserId: auth.context.systemUserId,
      staffName,
      applicationId,
      result: "activated",
      resultPayload,
      sourcePayload: {},
    });
    try { await broadcastStaffMembershipRefresh(gymId); } catch (error) { console.error("Offline activation refresh failed.", error); }
    return NextResponse.json(stored, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
