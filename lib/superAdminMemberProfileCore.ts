export const EDITABLE_PROFILE_FIELDS = [
  "firstName", "lastName", "email", "mobile", "dateOfBirth", "idNumber",
  "addressLine1", "addressLine2", "town", "postcode", "nextOfKin",
] as const;

export type MemberProfileDraft = Record<(typeof EDITABLE_PROFILE_FIELDS)[number], string>;

export function isRealDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateMemberProfile(value: unknown):
  | { ok: true; profile: MemberProfileDraft }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Member profile must be an object." };
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== EDITABLE_PROFILE_FIELDS.length
    || keys.some((key) => !(EDITABLE_PROFILE_FIELDS as readonly string[]).includes(key))
    || EDITABLE_PROFILE_FIELDS.some((key) => typeof record[key] !== "string")) {
    return { ok: false, error: "Only the approved personal detail fields can be saved." };
  }
  const profile = Object.fromEntries(
    EDITABLE_PROFILE_FIELDS.map((key) => [key, (record[key] as string).trim()])
  ) as MemberProfileDraft;
  if (!profile.firstName || !profile.lastName
    || profile.firstName.length > 100 || profile.lastName.length > 100) {
    return { ok: false, error: "Enter a first and last name (100 characters maximum each)." };
  }
  if (profile.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email.length > 254)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (Object.values(profile).some((field) => field.length > 500)) {
    return { ok: false, error: "A member profile field is too long." };
  }
  if (profile.dateOfBirth && (!isRealDate(profile.dateOfBirth)
    || profile.dateOfBirth > new Date().toISOString().slice(0, 10))) {
    return { ok: false, error: "Enter a valid date of birth." };
  }
  return { ok: true, profile };
}
