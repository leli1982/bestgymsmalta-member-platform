export const MEMBERSHIP_NUMBER_PATTERN = /^BGM(\d{7})$/;

export function formatMembershipNumber(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 9_999_999) {
    throw new Error("Membership number must be between 1 and 9999999.");
  }

  return `BGM${String(value).padStart(7, "0")}`;
}

export function normalizeMembershipNumber(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function parseMembershipNumber(value: unknown) {
  const normalized = normalizeMembershipNumber(value);
  const match = normalized.match(MEMBERSHIP_NUMBER_PATTERN);
  if (!match) return null;

  const parsed = Number(match[1]);
  return parsed >= 1 && parsed <= 9_999_999 ? parsed : null;
}
