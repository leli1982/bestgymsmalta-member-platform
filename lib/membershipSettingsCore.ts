export type MembershipType = "single" | "student" | "couples";

export type MembershipDurationKey =
  | "1_week"
  | "2_weeks"
  | "1_month"
  | "3_months"
  | "6_months"
  | "1_year";

export type DeclarationKey =
  | "gym_rules"
  | "legacy_declaration"
  | "privacy"
  | "health"
  | "guardian";

export type PriceEntry = {
  membershipType: MembershipType;
  durationKey: MembershipDurationKey;
  amountCents: number;
  currency: "EUR";
};

const MEMBERSHIP_TYPES: readonly MembershipType[] = ["single", "student", "couples"];
const DURATION_KEYS: readonly MembershipDurationKey[] = [
  "1_week",
  "2_weeks",
  "1_month",
  "3_months",
  "6_months",
  "1_year",
];

export function normalizeDiscountCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validatePriceMatrix(
  entries: PriceEntry[],
): { ok: true } | { ok: false; error: string } {
  if (entries.length !== MEMBERSHIP_TYPES.length * DURATION_KEYS.length) {
    return { ok: false, error: "Price matrix must contain exactly 18 combinations." };
  }

  const expected = new Set(
    MEMBERSHIP_TYPES.flatMap((membershipType) =>
      DURATION_KEYS.map((durationKey) => `${membershipType}:${durationKey}`),
    ),
  );
  const seen = new Set<string>();

  for (const entry of entries) {
    if (
      !MEMBERSHIP_TYPES.includes(entry.membershipType) ||
      !DURATION_KEYS.includes(entry.durationKey)
    ) {
      return { ok: false, error: "Price matrix contains an unsupported combination." };
    }
    if (!Number.isInteger(entry.amountCents) || entry.amountCents < 0) {
      return { ok: false, error: "Price amounts must be non-negative integer cents." };
    }
    if (entry.currency !== "EUR") {
      return { ok: false, error: "Price currency must be EUR." };
    }

    const key = `${entry.membershipType}:${entry.durationKey}`;
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate price combination: ${key}.` };
    }
    seen.add(key);
    expected.delete(key);
  }

  if (expected.size > 0) {
    return { ok: false, error: "Price matrix is missing a required combination." };
  }

  return { ok: true };
}

export function discountAmountCents(base: number, percentage: number): number {
  if (!Number.isInteger(base) || base < 0) {
    throw new Error("Invalid base price.");
  }
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
    throw new Error("Invalid discount percentage.");
  }
  return Math.round((base * percentage) / 100);
}

export function requiredDeclarationKeys(): DeclarationKey[] {
  return ["gym_rules", "privacy", "health"];
}
