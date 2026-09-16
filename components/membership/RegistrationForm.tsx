"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  isUnder18On,
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
import LivePhotoCapture from "./LivePhotoCapture";
import RegistrationDeclarations, {
  type PublishedDeclaration,
  type RegistrationDeclarationAcceptance,
} from "./RegistrationDeclarations";
import RegistrationDocumentWarning from "./RegistrationDocumentWarning";

export type PublicEnrollmentConfig = {
  gym: { id: string; name: string; shortName: string; slug: string };
  pricing: {
    versionId: string;
    entries: Array<{
      membershipType: MembershipType;
      durationKey: MembershipDurationKey;
      amountCents: number;
      currency: "EUR";
    }>;
  };
  declarations: {
    gymRules: PublishedDeclaration;
    privacy: PublishedDeclaration;
    health: PublishedDeclaration;
    guardian?: PublishedDeclaration;
  };
};

export type RegistrationDraft = {
  gymSlug: string;
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  participants: RegistrationParticipant[];
  declarations: RegistrationDeclarationAcceptance[];
  photos: Array<File | null>;
  documentReadinessAcknowledged: true;
};

export type RegistrationFormProps = {
  mode: "tablet" | "staff";
  gym: { id: string; name: string; slug?: string };
  config: PublicEnrollmentConfig;
  initialParticipants?: RegistrationParticipant[];
  onSubmit: (draft: RegistrationDraft) => Promise<void>;
  staffPhotoPolicy?: "required" | "optional";
};

type IdentityUiState = "idle" | "checking" | "error" | IdentityMatchState;

type ParticipantField = Exclude<keyof RegistrationParticipant, "guardian">;
type GuardianField = "fullName" | "idNumber" | "relationship" | "mobile" | "email" | "address";

const MEMBERSHIP_OPTIONS: Array<{ value: MembershipType; label: string }> = [
  { value: "single", label: "Regular" },
  { value: "student", label: "Student" },
  { value: "couples", label: "Couples" },
];

const DURATION_OPTIONS: Array<{ value: MembershipDurationKey; label: string }> = [
  { value: "1_week", label: "1 week" },
  { value: "2_weeks", label: "2 weeks" },
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
];

const BLANK_ACCEPTANCE: RegistrationDeclarationAcceptance = {
  gymRules: false,
  privacy: false,
  health: false,
};

function blankParticipant(): RegistrationParticipant {
  return {
    firstName: "",
    lastName: "",
    idNumber: "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    phone: "",
    email: "",
    nextOfKin: "",
  };
}

function cloneParticipant(participant: RegistrationParticipant): RegistrationParticipant {
  return {
    ...participant,
    ...(participant.guardian ? { guardian: { ...participant.guardian } } : {}),
  };
}

function maltaCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function formatEur(amountCents: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function inputClass() {
  return "mt-1 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10";
}

export default function RegistrationForm({
  mode,
  gym,
  config,
  initialParticipants,
  onSubmit,
  staffPhotoPolicy = "optional",
}: RegistrationFormProps) {
  const [membershipType, setMembershipType] = useState<MembershipType | "">("");
  const [durationKey, setDurationKey] = useState<MembershipDurationKey | "">("");
  const [documentReady, setDocumentReady] = useState(false);
  const [participants, setParticipants] = useState<RegistrationParticipant[]>(() => [
    initialParticipants?.[0] ? cloneParticipant(initialParticipants[0]) : blankParticipant(),
  ]);
  const [declarations, setDeclarations] = useState<RegistrationDeclarationAcceptance[]>([
    { ...BLANK_ACCEPTANCE },
  ]);
  const [photos, setPhotos] = useState<Array<File | null>>([null]);
  const [identityStates, setIdentityStates] = useState<IdentityUiState[]>(["idle"]);
  const [identityMessages, setIdentityMessages] = useState<string[]>([""]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionDate = useMemo(() => maltaCalendarDate(), []);
  const gymSlug = gym.slug || config.gym.slug;
  const photoRequired = mode === "tablet" || staffPhotoPolicy === "required";

  const selectedPrice = useMemo(() => {
    if (!membershipType || !durationKey) return null;
    return (
      config.pricing.entries.find(
        (entry) =>
          entry.membershipType === membershipType && entry.durationKey === durationKey,
      ) || null
    );
  }, [config.pricing.entries, durationKey, membershipType]);

  function chooseMembershipType(next: MembershipType) {
    const count = participantCountForType(next);
    setMembershipType(next);
    setDocumentReady(false);
    setFormError("");
    setParticipants((current) =>
      Array.from({ length: count }, (_, index) =>
        current[index]
          ? cloneParticipant(current[index])
          : initialParticipants?.[index]
            ? cloneParticipant(initialParticipants[index])
            : blankParticipant(),
      ),
    );
    setDeclarations(Array.from({ length: count }, () => ({ ...BLANK_ACCEPTANCE })));
    setPhotos(Array.from({ length: count }, () => null));
    setIdentityStates(Array.from({ length: count }, () => "idle"));
    setIdentityMessages(Array.from({ length: count }, () => ""));
  }

  function updateParticipant(index: number, field: ParticipantField, value: string) {
    setParticipants((current) =>
      current.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, [field]: value } : participant,
      ),
    );

    if (field === "idNumber") {
      setIdentityStates((current) =>
        current.map((state, participantIndex) =>
          participantIndex === index ? "idle" : state,
        ),
      );
      setIdentityMessages((current) =>
        current.map((message, participantIndex) =>
          participantIndex === index ? "" : message,
        ),
      );
    }
  }

  function updateGuardian(index: number, field: GuardianField, value: string) {
    setParticipants((current) =>
      current.map((participant, participantIndex) => {
        if (participantIndex !== index) return participant;
        const guardian = participant.guardian || {
          fullName: "",
          idNumber: "",
          relationship: "",
          mobile: "",
          email: "",
          address: "",
        };
        return { ...participant, guardian: { ...guardian, [field]: value } };
      }),
    );
  }

  function updateAcceptance(index: number, value: RegistrationDeclarationAcceptance) {
    setDeclarations((current) =>
      current.map((acceptance, participantIndex) =>
        participantIndex === index ? value : acceptance,
      ),
    );
  }

  function updatePhoto(index: number, file: File) {
    setPhotos((current) =>
      current.map((photo, participantIndex) => (participantIndex === index ? file : photo)),
    );
    setFormError("");
  }

  async function checkIdentity(index: number) {
    const idNumber = participants[index]?.idNumber || "";
    const normalized = normalizeIdentityDocument(idNumber);
    if (normalized.length < 4 || !gymSlug) return;

    setIdentityStates((current) =>
      current.map((state, participantIndex) =>
        participantIndex === index ? "checking" : state,
      ),
    );
    setIdentityMessages((current) =>
      current.map((message, participantIndex) =>
        participantIndex === index ? "Checking existing memberships…" : message,
      ),
    );

    try {
      const response = await fetch("/api/public/membership-enrollment/identity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymSlug, idNumber }),
      });
      const data = await response.json();
      if (!response.ok || !["clear", "active", "expired_inactive"].includes(data.state)) {
        throw new Error("Identity check failed");
      }

      const state = data.state as IdentityMatchState;
      setIdentityStates((current) =>
        current.map((item, participantIndex) =>
          participantIndex === index ? state : item,
        ),
      );
      setIdentityMessages((current) =>
        current.map((message, participantIndex) => {
          if (participantIndex !== index) return message;
          if (state === "active") {
            return "An active membership already exists for this ID. Please speak to reception.";
          }
          if (state === "expired_inactive") {
            return "An existing membership was found. Reception will review this application as a possible renewal.";
          }
          return "";
        }),
      );
    } catch {
      setIdentityStates((current) =>
        current.map((state, participantIndex) =>
          participantIndex === index ? "error" : state,
        ),
      );
      setIdentityMessages((current) =>
        current.map((message, participantIndex) =>
          participantIndex === index
            ? "We could not check this ID right now. Please try again before submitting."
            : message,
        ),
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!membershipType || !durationKey || !documentReady || !selectedPrice) {
      setFormError("Choose a membership, duration and confirm the reception document requirements.");
      return;
    }

    for (let index = 0; index < participants.length; index += 1) {
      const validationErrors = validateRegistrationParticipant(participants[index], submissionDate);
      if (validationErrors.length > 0) {
        setFormError(`Applicant ${index + 1}: ${validationErrors[0]}`);
        return;
      }
      if (identityStates[index] === "active") {
        setFormError("An applicant already has an active membership. Please speak to reception.");
        return;
      }
      if (identityStates[index] === "checking" || identityStates[index] === "error") {
        setFormError("Complete the ID check before submitting.");
        return;
      }
      if (
        !declarations[index]?.gymRules ||
        !declarations[index]?.privacy ||
        !declarations[index]?.health
      ) {
        setFormError(`Applicant ${index + 1} must accept all required declarations.`);
        return;
      }
      if (photoRequired && !photos[index]) {
        setFormError(`Applicant ${index + 1} needs a live membership photo.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        gymSlug,
        membershipType,
        durationKey,
        participants: participants.map(cloneParticipant),
        declarations: declarations.map((item) => ({ ...item })),
        photos: [...photos],
        documentReadinessAcknowledged: true,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not submit the application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Membership</p>
        <h1 className="mt-1 text-2xl font-black text-zinc-950">Join {gym.name}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Choose the membership that applies to you. Reception will verify the supporting documents before activation.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MEMBERSHIP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseMembershipType(option.value)}
              className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                membershipType === option.value
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-950 hover:border-zinc-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-bold text-zinc-800">
          Membership duration
          <select
            value={durationKey}
            onChange={(event) => setDurationKey(event.target.value as MembershipDurationKey | "")}
            disabled={!membershipType}
            className={inputClass()}
          >
            <option value="">Choose duration</option>
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {selectedPrice && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
            <span className="text-sm font-bold text-emerald-800">Current membership price</span>
            <span className="text-xl font-black text-emerald-950">
              {formatEur(selectedPrice.amountCents)}
            </span>
          </div>
        )}
      </section>

      {membershipType && (
        <RegistrationDocumentWarning
          membershipType={membershipType}
          acknowledged={documentReady}
          onAcknowledge={setDocumentReady}
        />
      )}

      {membershipType && documentReady &&
        participants.map((participant, index) => {
          let under18 = false;
          if (participant.dateOfBirth) {
            try {
              under18 = isUnder18On(participant.dateOfBirth, submissionDate);
            } catch {
              under18 = false;
            }
          }
          const identityState = identityStates[index] || "idle";
          const identityMessage = identityMessages[index] || "";

          return (
            <section key={index} className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  {membershipType === "couples" ? `Couples applicant ${index + 1}` : "Applicant details"}
                </p>
                <h2 className="mt-1 text-xl font-black text-zinc-950">
                  {membershipType === "couples" ? `Applicant ${index + 1}` : "Your details"}
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-zinc-800">
                  First name
                  <input value={participant.firstName} onChange={(event) => updateParticipant(index, "firstName", event.target.value)} className={inputClass()} autoComplete="given-name" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Last name
                  <input value={participant.lastName} onChange={(event) => updateParticipant(index, "lastName", event.target.value)} className={inputClass()} autoComplete="family-name" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  ID card / passport number
                  <input
                    value={participant.idNumber}
                    onChange={(event) => updateParticipant(index, "idNumber", event.target.value)}
                    onBlur={() => checkIdentity(index)}
                    className={inputClass()}
                    autoComplete="off"
                  />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Date of birth
                  <input type="date" value={participant.dateOfBirth} onChange={(event) => updateParticipant(index, "dateOfBirth", event.target.value)} className={inputClass()} />
                </label>
              </div>

              {identityMessage && (
                <div
                  className={`rounded-2xl border p-4 text-sm font-semibold ${
                    identityState === "active"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : identityState === "expired_inactive"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {identityMessage}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-zinc-800 sm:col-span-2">
                  Address
                  <input value={participant.addressLine1} onChange={(event) => updateParticipant(index, "addressLine1", event.target.value)} className={inputClass()} autoComplete="address-line1" />
                </label>
                <label className="text-sm font-bold text-zinc-800 sm:col-span-2">
                  Address line 2 <span className="font-medium text-zinc-400">(optional)</span>
                  <input value={participant.addressLine2} onChange={(event) => updateParticipant(index, "addressLine2", event.target.value)} className={inputClass()} autoComplete="address-line2" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Town / locality
                  <input value={participant.town} onChange={(event) => updateParticipant(index, "town", event.target.value)} className={inputClass()} autoComplete="address-level2" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Postcode <span className="font-medium text-zinc-400">(optional)</span>
                  <input value={participant.postcode} onChange={(event) => updateParticipant(index, "postcode", event.target.value)} className={inputClass()} autoComplete="postal-code" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Mobile / phone
                  <input type="tel" value={participant.phone} onChange={(event) => updateParticipant(index, "phone", event.target.value)} className={inputClass()} autoComplete="tel" />
                </label>
                <label className="text-sm font-bold text-zinc-800">
                  Email
                  <input type="email" value={participant.email} onChange={(event) => updateParticipant(index, "email", event.target.value)} className={inputClass()} autoComplete="email" />
                </label>
                <label className="text-sm font-bold text-zinc-800 sm:col-span-2">
                  Next of kin / emergency contact
                  <input value={participant.nextOfKin} onChange={(event) => updateParticipant(index, "nextOfKin", event.target.value)} className={inputClass()} />
                </label>
              </div>

              {under18 && (
                <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Under 18</p>
                  <h3 className="mt-1 text-lg font-black text-violet-950">Parent / legal guardian details</h3>
                  <p className="mt-1 text-sm leading-6 text-violet-900">
                    The guardian must attend reception and co-sign the printed application before this membership can be activated.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-violet-950">
                      Guardian full name
                      <input value={participant.guardian?.fullName || ""} onChange={(event) => updateGuardian(index, "fullName", event.target.value)} className={inputClass()} />
                    </label>
                    <label className="text-sm font-bold text-violet-950">
                      Guardian ID / passport number
                      <input value={participant.guardian?.idNumber || ""} onChange={(event) => updateGuardian(index, "idNumber", event.target.value)} className={inputClass()} />
                    </label>
                    <label className="text-sm font-bold text-violet-950">
                      Relationship
                      <input value={participant.guardian?.relationship || ""} onChange={(event) => updateGuardian(index, "relationship", event.target.value)} className={inputClass()} />
                    </label>
                    <label className="text-sm font-bold text-violet-950">
                      Guardian mobile
                      <input type="tel" value={participant.guardian?.mobile || ""} onChange={(event) => updateGuardian(index, "mobile", event.target.value)} className={inputClass()} />
                    </label>
                    <label className="text-sm font-bold text-violet-950">
                      Guardian email
                      <input type="email" value={participant.guardian?.email || ""} onChange={(event) => updateGuardian(index, "email", event.target.value)} className={inputClass()} />
                    </label>
                    <label className="text-sm font-bold text-violet-950">
                      Guardian address
                      <input value={participant.guardian?.address || ""} onChange={(event) => updateGuardian(index, "address", event.target.value)} className={inputClass()} />
                    </label>
                  </div>
                </div>
              )}

              {(photoRequired || mode === "staff") && (
                <LivePhotoCapture
                  label={`Applicant ${index + 1} live membership photo`}
                  required={photoRequired}
                  onUsePhoto={(file) => updatePhoto(index, file)}
                />
              )}

              <RegistrationDeclarations
                participantLabel={membershipType === "couples" ? `Applicant ${index + 1}` : "Applicant"}
                gymRules={config.declarations.gymRules}
                privacy={config.declarations.privacy}
                health={config.declarations.health}
                guardian={config.declarations.guardian}
                showGuardian={under18}
                value={declarations[index] || { ...BLANK_ACCEPTANCE }}
                onChange={(value) => updateAcceptance(index, value)}
              />
            </section>
          );
        })}

      {formError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {formError}
        </div>
      )}

      {membershipType && documentReady && (
        <button
          type="submit"
          disabled={submitting || !durationKey}
          className="w-full rounded-2xl bg-zinc-950 px-5 py-4 text-base font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting application…" : "Submit application"}
        </button>
      )}
    </form>
  );
}
