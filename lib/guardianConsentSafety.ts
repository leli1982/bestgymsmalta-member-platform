import { isUnder18On } from "./membershipRegistrationCore.ts";

type Participant = {
  participant_order: number;
  date_of_birth: string | null;
  under_18_at_submission: boolean | null;
  guardian_name: string | null;
  guardian_id_number: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_address: string | null;
  guardian_present_verified_at?: string | null;
  guardian_cosign_verified_at?: string | null;
};

export function pendingGuardianConsentGap(
  submittedAt: string | null,
  snapshot: { guardian?: { body?: string } | null } | null,
  participants: Participant[],
  requireVerifiedSignatures = false,
): string | null {
  if (!submittedAt || !Number.isFinite(Date.parse(submittedAt))) {
    return "Cannot verify the guardian consent submission date.";
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(submittedAt));
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const onDate = `${date.year}-${date.month}-${date.day}`;
  if (!participants.length) return "Cannot verify application participants.";
  for (const p of participants) {
    if (!p.date_of_birth) return `Applicant ${p.participant_order}: A verified date of birth is required.`;
    let under18: boolean;
    try {
      under18 = isUnder18On(p.date_of_birth, onDate);
    } catch {
      return `Applicant ${p.participant_order}: Date of birth is invalid.`;
    }
    if (!under18) continue;
    if (!p.under_18_at_submission || !snapshot?.guardian?.body?.trim()) {
      return `Applicant ${p.participant_order}: Under-18 guardian consent was not recorded at submission. This application cannot be printed or activated.`;
    }
    if ([p.guardian_name,p.guardian_id_number,p.guardian_relationship,p.guardian_phone,p.guardian_email,p.guardian_address].some(v=>!v?.trim())) {
      return `Applicant ${p.participant_order}: Complete guardian details are required.`;
    }
    if (requireVerifiedSignatures && (!p.guardian_present_verified_at || !p.guardian_cosign_verified_at)) {
      return `Applicant ${p.participant_order}: Guardian attendance and co-sign verification are required before activation.`;
    }
  }
  return null;
}
