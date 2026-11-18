// Staff are authorised for contact/identity corrections only. Never reuse the
// larger Super Admin profile allowlist: date of birth, term, gym and finance
// changes are not permitted in this workflow.
export const STAFF_PERSONAL_DETAIL_FIELDS = [
  "firstName", "lastName", "idNumber",
  "addressLine1", "addressLine2", "town", "postcode", "country",
  "mobile", "phone", "telephoneNo1", "telephoneNo2", "email", "nextOfKin",
] as const;

export type StaffPersonalDetails = Record<(typeof STAFF_PERSONAL_DETAIL_FIELDS)[number], string>;

export function validateStaffPersonalDetails(value: unknown):
  | { ok: true; profile: StaffPersonalDetails }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Member personal details are required." };
  }
  const fields = value as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (keys.length !== STAFF_PERSONAL_DETAIL_FIELDS.length ||
      keys.some(key => !STAFF_PERSONAL_DETAIL_FIELDS.includes(key as typeof STAFF_PERSONAL_DETAIL_FIELDS[number])) ||
      STAFF_PERSONAL_DETAIL_FIELDS.some(key => typeof fields[key] !== "string")) {
    return { ok: false, error: "Only approved personal and contact details may be edited." };
  }
  const profile = Object.fromEntries(
    STAFF_PERSONAL_DETAIL_FIELDS.map(key => [key, (fields[key] as string).trim()])
  ) as StaffPersonalDetails;
  if (!profile.firstName || !profile.lastName ||
      profile.firstName.length > 100 || profile.lastName.length > 100) {
    return { ok: false, error: "Enter a first name and surname (up to 100 characters each)." };
  }
  if (profile.email && (profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (Object.values(profile).some(v => v.length > 500)) {
    return { ok: false, error: "A personal-detail field exceeds 500 characters." };
  }
  return { ok: true, profile };
}
