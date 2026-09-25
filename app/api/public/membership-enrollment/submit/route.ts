import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { calculateMembershipExpiry } from "@/lib/membershipEnrollmentCore";
import {
  isUnder18On,
  isUnder16On,
  normalizeIdentityDocument,
  participantCountForType,
  validateRegistrationParticipant,
} from "@/lib/membershipRegistrationCore";
import type {
  IdentityMatchState,
  RegistrationParticipant,
} from "@/lib/membershipRegistrationTypes";
import type {
  MembershipDurationKey,
  MembershipType,
} from "@/lib/membershipSettingsCore";
import {
  PUBLIC_SUBMISSIONS_PER_HOUR,
  hashPublicRateKey,
  hourlyRateWindow,
  requirePublicEnrollmentRateSalt,
  resolveClientIp,
} from "@/lib/publicEnrollmentSecurity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { broadcastStaffMembershipRefresh } from "@/lib/staffRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHOTO_BUCKET = "bgm-member-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PAYLOAD_CHARS = 64 * 1024;
const MEMBERSHIP_TYPES: readonly MembershipType[] = ["single", "student", "couples"];
const DURATION_KEYS: readonly MembershipDurationKey[] = [
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];
const PUBLIC_DECLARATION_KEYS = ["gym_rules", "privacy", "health", "guardian"] as const;
const PHOTO_FIELDS = ["photo0", "photo1"] as const;

type JsonRecord = Record<string, unknown>;

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

function maltaCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
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
    email: clean(raw.email),
    nextOfKin: clean(raw.nextOfKin),
    ...(hasGuardian
      ? {
          guardian: {
            fullName: clean(guardianRaw.fullName),
            idNumber: clean(guardianRaw.idNumber),
            relationship: clean(guardianRaw.relationship),
            mobile: clean(guardianRaw.mobile),
            email: clean(guardianRaw.email),
            address: clean(guardianRaw.address),
          },
        }
      : {}),
  };
}

function acceptance(value: unknown) {
  const raw = asRecord(value);
  return {
    gymRules: raw.gymRules === true,
    privacy: raw.privacy === true,
    health: raw.health === true,
  };
}

async function cleanupUploadedPhotos(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  uploadedPaths: string[],
) {
  if (uploadedPaths.length === 0) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
  if (error) {
    console.error("Could not clean up failed public-enrollment photo uploads.");
  }
}

export async function POST(request: NextRequest) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart form data is required." }, { status: 415 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payloadEntries = formData.getAll("payload");
  if (payloadEntries.length !== 1 || typeof payloadEntries[0] !== "string") {
    return NextResponse.json({ error: "Enrollment payload is required." }, { status: 400 });
  }
  if (payloadEntries[0].length === 0 || payloadEntries[0].length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json({ error: "Enrollment payload is invalid." }, { status: 413 });
  }

  let draft: JsonRecord;
  try {
    draft = asRecord(JSON.parse(payloadEntries[0]));
  } catch {
    return NextResponse.json({ error: "Enrollment payload is invalid." }, { status: 400 });
  }

  const gymSlug = clean(draft.gymSlug).toLowerCase();
  const membershipTypeValue = clean(draft.membershipType);
  const durationKeyValue = clean(draft.durationKey);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymSlug) ||
    !isMembershipType(membershipTypeValue) ||
    !isDurationKey(durationKeyValue) ||
    draft.documentReadinessAcknowledged !== true
  ) {
    return NextResponse.json({ error: "Enrollment details are incomplete." }, { status: 400 });
  }

  const membershipType = membershipTypeValue;
  const durationKey = durationKeyValue;
  const expectedParticipantCount = participantCountForType(membershipType);
  const participantValues = Array.isArray(draft.participants) ? draft.participants : [];
  const declarationValues = Array.isArray(draft.declarations) ? draft.declarations : [];

  if (
    participantValues.length !== expectedParticipantCount ||
    declarationValues.length !== expectedParticipantCount
  ) {
    return NextResponse.json({ error: "Participant count is invalid." }, { status: 400 });
  }

  const photos: File[] = [];
  for (let index = 0; index < expectedParticipantCount; index += 1) {
    const entries = formData.getAll(PHOTO_FIELDS[index]);
    if (entries.length !== 1 || !(entries[0] instanceof File)) {
      return NextResponse.json({ error: `${PHOTO_FIELDS[index]} is required.` }, { status: 400 });
    }
    const file = entries[0];
    if (file.type !== "image/webp") {
      return NextResponse.json({ error: "Live photos must be WebP images." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Each live photo must be 5 MB or smaller." }, { status: 413 });
    }
    photos.push(file);
  }
  if (expectedParticipantCount === 1 && formData.get("photo1") !== null) {
    return NextResponse.json({ error: "Unexpected second photo." }, { status: 400 });
  }

  const submittedOnMalta = maltaCalendarDate();
  const expiryDate = calculateMembershipExpiry(submittedOnMalta, durationKey);
  const sanitizedParticipants: RegistrationParticipant[] = [];
  const under18Flags: boolean[] = [];
  const under16Flags: boolean[] = [];
  const acceptances = declarationValues.map(acceptance);

  for (let index = 0; index < expectedParticipantCount; index += 1) {
    const participant = sanitizeParticipant(participantValues[index]);
    const errors = validateRegistrationParticipant(participant, submittedOnMalta);
    const declarations = acceptances[index];
    if (
      errors.length > 0 ||
      declarations.gymRules !== true ||
      declarations.privacy !== true ||
      declarations.health !== true
    ) {
      return NextResponse.json({ error: "Please check the application details." }, { status: 400 });
    }

    sanitizedParticipants.push(participant);
    under18Flags.push(isUnder18On(participant.dateOfBirth, submittedOnMalta));
    under16Flags.push(isUnder16On(participant.dateOfBirth, submittedOnMalta));
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: gym, error: gymError } = await supabase
    .from("bgm_gyms")
    .select("id,name,public_enrollment_slug,status")
    .eq("public_enrollment_slug", gymSlug)
    .eq("status", "active")
    .maybeSingle();

  if (gymError) {
    console.error("Public enrollment gym lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!gym) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  const windowStart = hourlyRateWindow();
  let rateKeyHash: string;
  try {
    rateKeyHash = hashPublicRateKey({
      ip: resolveClientIp(request),
      gymSlug,
      action: "submission",
      windowStart,
      secret: requirePublicEnrollmentRateSalt(),
    });
  } catch {
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }

  const { data: allowed, error: rateError } = await supabase.rpc(
    "bgm_consume_public_enrollment_rate_limit",
    {
      p_rate_key_hash: rateKeyHash,
      p_enrollment_gym_id: gym.id,
      p_window_start: windowStart,
      p_limit: PUBLIC_SUBMISSIONS_PER_HOUR,
    },
  );
  if (rateError) {
    console.error("Public enrollment submission rate-limit check failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data: catalog, error: catalogError } = await supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id,version_no,status")
    .eq("status", "published")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (catalogError) {
    console.error("Public enrollment price catalog lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (!catalog) {
    return NextResponse.json({ error: "Enrollment is not ready." }, { status: 503 });
  }

  const [
    { data: priceEntry, error: priceError },
    { data: declarationRows, error: declarationError },
  ] = await Promise.all([
    supabase
      .from("bgm_membership_price_entries")
      .select("amount_cents,currency,is_active")
      .eq("catalog_version_id", catalog.id)
      .eq("membership_type", membershipType)
      .eq("duration_key", durationKey)
      .maybeSingle(),
    supabase
      .from("bgm_membership_declaration_versions")
      .select("id,content_key,version_no,body,content_sha256,status")
      .eq("status", "published")
      .in("content_key", [...PUBLIC_DECLARATION_KEYS]),
  ]);

  if (priceError || declarationError) {
    console.error("Public enrollment settings lookup failed.");
    return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
  }
  if (
    !priceEntry ||
    priceEntry.currency !== "EUR" ||
    priceEntry.is_active === false ||
    !Number.isInteger(Number(priceEntry.amount_cents)) ||
    Number(priceEntry.amount_cents) < 0
  ) {
    return NextResponse.json({ error: "Enrollment is not ready." }, { status: 503 });
  }

  const declarationByKey = new Map(
    (declarationRows || []).map((row) => [String(row.content_key), row]),
  );
  const gymRules = declarationByKey.get("gym_rules");
  const privacy = declarationByKey.get("privacy");
  const health = declarationByKey.get("health");
  const guardianDeclaration = declarationByKey.get("guardian");
  if (!gymRules || !privacy || !health || (under16Flags.some(Boolean) && !guardianDeclaration)) {
    return NextResponse.json({ error: "Enrollment is not ready." }, { status: 503 });
  }

  const serverParticipants: ServerParticipant[] = [];
  for (let index = 0; index < sanitizedParticipants.length; index += 1) {
    const participant = sanitizedParticipants[index];
    const normalizedId = normalizeIdentityDocument(participant.idNumber);
    const { data: classification, error: classificationError } = await supabase.rpc(
      "bgm_classify_membership_identity",
      { p_id_number: normalizedId },
    );

    if (classificationError) {
      console.error("Public enrollment identity classification failed.");
      return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
    }

    const classificationRecord = asRecord(classification);
    const state = classificationRecord.state;
    if (!isIdentityState(state)) {
      return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
    }
    if (state === "active") {
      return NextResponse.json(
        { error: "An active membership already exists for this identity. Please speak to reception." },
        { status: 409 },
      );
    }

    const matchedMemberId =
      typeof classificationRecord.matchedMemberId === "string"
        ? classificationRecord.matchedMemberId
        : null;

    const { data: duplicateContactWarning, error: contactError } = await supabase.rpc(
      "bgm_has_membership_contact_match",
      {
        p_phone: participant.phone,
        p_email: participant.email,
      },
    );
    if (contactError) {
      console.error("Public enrollment contact duplicate check failed.");
      return NextResponse.json({ error: "Enrollment service is unavailable." }, { status: 503 });
    }

    serverParticipants.push({
      participant,
      under18AtSubmission: under18Flags[index],
      identityMatchState: state,
      matchedMemberId,
      duplicateContactWarning: duplicateContactWarning === true,
      gymRulesAccepted: acceptances[index].gymRules,
      privacyAccepted: acceptances[index].privacy,
      healthAccepted: acceptances[index].health,
    });
  }

  const applicationId = randomUUID();
  const participantIds = serverParticipants.map(() => randomUUID());
  const uploadedPaths: string[] = [];

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const participantId = participantIds[index];
      const objectPath = `applications/${applicationId}/${participantId}/${randomUUID()}.webp`;
      const bytes = Buffer.from(await photos[index].arrayBuffer());
      const upload = await supabase.storage.from(PHOTO_BUCKET).upload(objectPath, bytes, {
        contentType: "image/webp",
        cacheControl: "60",
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploadedPaths.push(objectPath);
    }

    const declarationSnapshot = {
      gymRules: {
        id: gymRules.id,
        versionNo: Number(gymRules.version_no),
        body: gymRules.body,
        contentSha256: gymRules.content_sha256,
      },
      privacy: {
        id: privacy.id,
        versionNo: Number(privacy.version_no),
        body: privacy.body,
        contentSha256: privacy.content_sha256,
      },
      health: {
        id: health.id,
        versionNo: Number(health.version_no),
        body: health.body,
        contentSha256: health.content_sha256,
      },
      ...(guardianDeclaration && under16Flags.some(Boolean)
        ? {
            guardian: {
              id: guardianDeclaration.id,
              versionNo: Number(guardianDeclaration.version_no),
              body: guardianDeclaration.body,
              contentSha256: guardianDeclaration.content_sha256,
            },
          }
        : {}),
    };

    const rpcPayload = {
      applicationId,
      applicationSource: "tablet",
      enrollmentGymId: gym.id,
      membershipType,
      durationKey,
      startDate: submittedOnMalta,
      expiryDate,
      basePriceCents: Number(priceEntry.amount_cents),
      priceCatalogVersionId: catalog.id,
      declarationSnapshot,
      documentReadinessAcknowledged: true,
      participants: serverParticipants.map((serverParticipant, index) => ({
        participantId: participantIds[index],
        firstName: serverParticipant.participant.firstName,
        lastName: serverParticipant.participant.lastName,
        addressLine1: serverParticipant.participant.addressLine1,
        addressLine2: serverParticipant.participant.addressLine2,
        town: serverParticipant.participant.town,
        postcode: serverParticipant.participant.postcode,
        idNumber: serverParticipant.participant.idNumber,
        dateOfBirth: serverParticipant.participant.dateOfBirth,
        phone: serverParticipant.participant.phone,
        email: serverParticipant.participant.email,
        nextOfKin: serverParticipant.participant.nextOfKin,
        guardianName: serverParticipant.participant.guardian?.fullName || null,
        guardianIdNumber: serverParticipant.participant.guardian?.idNumber || null,
        guardianRelationship: serverParticipant.participant.guardian?.relationship || null,
        guardianPhone: serverParticipant.participant.guardian?.mobile || null,
        guardianEmail: serverParticipant.participant.guardian?.email || null,
        guardianAddress: serverParticipant.participant.guardian?.address || null,
        under18AtSubmission: serverParticipant.under18AtSubmission,
        identityMatchState: serverParticipant.identityMatchState,
        matchedMemberId: serverParticipant.matchedMemberId,
        duplicateContactWarning: serverParticipant.duplicateContactWarning,
        gymRulesAccepted: serverParticipant.gymRulesAccepted,
        privacyAccepted: serverParticipant.privacyAccepted,
        healthAccepted: serverParticipant.healthAccepted,
        officialPhotoPath: uploadedPaths[index],
      })),
    };

    const { data: creation, error: creationError } = await supabase.rpc(
      "bgm_create_public_membership_application",
      { p_payload: rpcPayload },
    );

    if (creationError) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      if (/active membership/i.test(creationError.message || "")) {
        return NextResponse.json(
          { error: "An active membership already exists for this identity. Please speak to reception." },
          { status: 409 },
        );
      }
      console.error("Public membership application creation failed.");
      return NextResponse.json({ error: "Could not submit application." }, { status: 500 });
    }

    const result = asRecord(creation);
    if (result.applicationId !== applicationId) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      console.error("Public membership application returned an unexpected identifier.");
      return NextResponse.json({ error: "Could not submit application." }, { status: 500 });
    }

    // The application has been committed. Alert the subscribed reception
    // dashboard immediately; the queue's polling remains the fallback.
    // Broadcast failures are handled by the helper and do not reject submission.
    await broadcastStaffMembershipRefresh(gym.id);

    return NextResponse.json(
      { ok: true, applicationId },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await cleanupUploadedPhotos(supabase, uploadedPaths);
    console.error("Public membership application submission failed.", error);
    return NextResponse.json({ error: "Could not submit application." }, { status: 500 });
  }
}
