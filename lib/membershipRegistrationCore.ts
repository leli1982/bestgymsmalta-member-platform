import type { MembershipType } from "@/lib/membershipSettingsCore";
import type {
  GuardianDetails,
  IdentityMatchState,
  RegistrationMode,
  RegistrationParticipant,
} from "@/lib/membershipRegistrationTypes";

export type {
  GuardianDetails,
  IdentityMatchState,
  RegistrationMode,
  RegistrationParticipant,
} from "@/lib/membershipRegistrationTypes";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    throw new Error("A valid calendar date in YYYY-MM-DD format is required.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("A valid calendar date is required.");
  }

  return { year, month, day };
}

export function normalizeIdentityDocument(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isUnderAgeOn(dateOfBirth: string, submissionDate: string, ageLimit: number): boolean {
  const birth = parseCalendarDate(dateOfBirth);
  const submitted = parseCalendarDate(submissionDate);

  const birthOrdinal = birth.year * 10000 + birth.month * 100 + birth.day;
  const submissionOrdinal = submitted.year * 10000 + submitted.month * 100 + submitted.day;
  if (birthOrdinal > submissionOrdinal) {
    throw new Error("Date of birth cannot be after the submission date.");
  }

  let age = submitted.year - birth.year;
  if (
    submitted.month < birth.month ||
    (submitted.month === birth.month && submitted.day < birth.day)
  ) {
    age -= 1;
  }

  return age < ageLimit;
}

export function isUnder18On(dateOfBirth: string, submissionDate: string): boolean {
  return isUnderAgeOn(dateOfBirth, submissionDate, 18);
}

export function isUnder16On(dateOfBirth: string, submissionDate: string): boolean {
  return isUnderAgeOn(dateOfBirth, submissionDate, 16);
}

// Couples eligibility is distinct from guardian consent: both applicants must be
// adults, even when a parent or guardian would consent to another membership type.
export function couplesAgeEligibilityError(
  membershipType: MembershipType,
  dateOfBirth: string,
  submissionDate: string,
): string | null {
  if (membershipType !== "couples" || !dateOfBirth.trim()) return null;
  return isUnder18On(dateOfBirth, submissionDate)
    ? "Couples membership is available only when both applicants are at least 18 years old."
    : null;
}

export function participantCountForType(type: MembershipType): 1 | 2 {
  if (type === "couples") return 2;
  if (type === "single" || type === "student") return 1;
  throw new Error("Unsupported membership type.");
}

export function requiredDocumentMessage(type: MembershipType): string[] {
  if (type === "single") {
    return ["Valid ID card or passport."];
  }
  if (type === "student") {
    return [
      "Valid ID card or passport.",
      "Valid student card or supporting student document.",
    ];
  }
  if (type === "couples") {
    return [
      "Valid ID cards or passports for both applicants.",
      "Documents or ID evidence showing both applicants reside at the same address.",
    ];
  }
  throw new Error("Unsupported membership type.");
}

function missing(value: unknown): boolean {
  return String(value ?? "").trim().length === 0;
}

export function validateRegistrationParticipant(
  participant: RegistrationParticipant,
  submissionDate: string,
): string[] {
  const errors: string[] = [];
  const requiredFields: Array<[keyof RegistrationParticipant, string]> = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["idNumber", "ID or passport number"],
    ["dateOfBirth", "Date of birth"],
    ["addressLine1", "Address"],
    ["town", "Town or locality"],
    ["phone", "Mobile number"],
    ["email", "Email"],
    ["nextOfKin", "Next of kin or emergency contact"],
  ];

  for (const [field, label] of requiredFields) {
    if (missing(participant[field])) {
      errors.push(`${label} is required.`);
    }
  }

  if (!missing(participant.idNumber) && !normalizeIdentityDocument(participant.idNumber)) {
    errors.push("ID or passport number is invalid.");
  }

  let under18 = false;
  if (!missing(participant.dateOfBirth)) {
    try {
      under18 = isUnder18On(participant.dateOfBirth, submissionDate);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Date of birth is invalid.");
    }
  } else {
    try {
      parseCalendarDate(submissionDate);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Submission date is invalid.");
    }
  }

  if (under18) {
    const guardian = participant.guardian;
    if (!guardian) {
      errors.push("Complete parent or legal guardian details are required for members under 18.");
    } else {
      const guardianFields: Array<[keyof GuardianDetails, string]> = [
        ["fullName", "Guardian full name"],
        ["idNumber", "Guardian ID or passport number"],
        ["relationship", "Guardian relationship"],
        ["mobile", "Guardian mobile number"],
        ["email", "Guardian email"],
        ["address", "Guardian address"],
      ];
      for (const [field, label] of guardianFields) {
        if (missing(guardian[field])) {
          errors.push(`${label} is required.`);
        }
      }
    }
  }

  return errors;
}
