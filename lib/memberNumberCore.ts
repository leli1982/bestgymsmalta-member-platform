export const MEMBERSHIP_NUMBER_PATTERN = /^BGM([1-9][0-9]{3,})$/;

const MIN_MEMBERSHIP_NUMBER = BigInt(1000);
const POSTGRES_BIGINT_MAX = BigInt("9223372036854775807");

export function formatMembershipNumber(value: number | bigint) {
  let numericValue: bigint;

  if (typeof value === "bigint") {
    numericValue = value;
  } else {
    if (!Number.isSafeInteger(value)) {
      throw new Error("Membership number must be a safe integer or bigint.");
    }
    numericValue = BigInt(value);
  }

  if (numericValue < MIN_MEMBERSHIP_NUMBER || numericValue > POSTGRES_BIGINT_MAX) {
    throw new Error("Membership number must be between 1000 and the PostgreSQL bigint maximum.");
  }

  return `BGM${numericValue.toString()}`;
}

export function normalizeMembershipNumber(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function parseMembershipNumber(value: unknown) {
  const normalized = normalizeMembershipNumber(value);
  const match = normalized.match(MEMBERSHIP_NUMBER_PATTERN);
  if (!match) return null;

  try {
    const parsed = BigInt(match[1]);
    return parsed <= POSTGRES_BIGINT_MAX ? match[1] : null;
  } catch {
    return null;
  }
}
