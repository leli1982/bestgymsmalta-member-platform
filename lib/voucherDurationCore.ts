import { isValidCalendarDate } from "@/lib/maltaDate";

/** Voucher promotion terms are separate from purchased duration and price. */
export const PROMOTION_FIELDS = "extension_months, eligible_duration_keys, eligible_membership_types, eligible_application_kinds, eligible_gym_ids";

export type TimedVoucherBonus = {
  bonus_months?: number;
  bonus_valid_from?: string | null;
  bonus_valid_until?: string | null;
};

export function effectiveVoucherExtension(voucher: TimedVoucherBonus & { extension_months?: number }, today: string): number {
  return voucher.bonus_months && voucher.bonus_valid_from && voucher.bonus_valid_until &&
    today >= voucher.bonus_valid_from && today <= voucher.bonus_valid_until
    ? voucher.bonus_months : voucher.extension_months || 0;
}

export function parseTimedVoucherBonus(body: Record<string, unknown>, percentage: number, permanentMonths: number) {
  const months = Number(body.bonusMonths ?? 0);
  if (!Number.isInteger(months) || months < 0 || months > 120) throw new Error("Bonus months must be a whole number from 0 to 120.");
  if (!months) return { bonus_months: 0, bonus_valid_from: null, bonus_valid_until: null };
  if (percentage <= 0 || permanentMonths > 0) throw new Error("A timed bonus must be attached to a percentage voucher without permanent free months.");
  const from = String(body.bonusValidFrom || ""), until = String(body.bonusValidUntil || "");
  if (!isValidCalendarDate(from) || !isValidCalendarDate(until) || from > until) throw new Error("Choose valid bonus start and end dates (inclusive).");
  return { bonus_months: months, bonus_valid_from: from, bonus_valid_until: until };
}

export type VoucherPromotion = TimedVoucherBonus & {
  extension_months: number;
  eligible_duration_keys: string[] | null;
  eligible_membership_types: string[] | null;
  eligible_application_kinds: string[] | null;
  eligible_gym_ids: string[] | null;
};

export type VoucherApplication = {
  id: string;
  membership_type: string;
  duration_key: string;
  application_kind: string;
  enrollment_gym_id: string;
  start_date: string | null;
  expiry_date: string | null;
  base_price_cents: number | null;
  price_catalog_version_id: string | null;
  access_scope: string;
  access_gym_id: string | null;
};

export type VoucherTerms = VoucherPromotion & {
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  reimbursement_value_cents: number | null;
  requires_verification: boolean;
};

export function hasAdvancedVoucherTerms(voucher: VoucherPromotion): boolean {
  return voucher.extension_months > 0 || voucher.eligible_duration_keys !== null ||
    voucher.eligible_membership_types !== null || voucher.eligible_application_kinds !== null ||
    voucher.eligible_gym_ids !== null;
}

export function isVoucherEligible(voucher: VoucherPromotion, application: Pick<VoucherApplication, "membership_type" | "duration_key" | "application_kind" | "enrollment_gym_id">): boolean {
  return (voucher.extension_months === 0 || application.duration_key !== "1_session") &&
    (!voucher.eligible_duration_keys || voucher.eligible_duration_keys.includes(application.duration_key)) &&
    (!voucher.eligible_membership_types || voucher.eligible_membership_types.includes(application.membership_type)) &&
    (!voucher.eligible_application_kinds || voucher.eligible_application_kinds.includes(application.application_kind)) &&
    (!voucher.eligible_gym_ids || voucher.eligible_gym_ids.includes(application.enrollment_gym_id));
}

// Same UTC month rollover as calculateMembershipExpiry. SQL uses month-start
// plus day offset, deliberately matching JS rather than PostgreSQL month clamp.
export function extendVoucherExpiry(baseExpiryDate: string, extensionMonths: number): string {
  const date = new Date(baseExpiryDate + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseExpiryDate) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== baseExpiryDate ||
      !Number.isInteger(extensionMonths) || extensionMonths < 0 || extensionMonths > 120) {
    throw new Error("Invalid voucher expiry or extension.");
  }
  date.setUTCMonth(date.getUTCMonth() + extensionMonths);
  return date.toISOString().slice(0, 10);
}

export function buildVoucherQuote(voucher: VoucherTerms, application: VoucherApplication, today: string) {
  const effectiveMonths = effectiveVoucherExtension(voucher, today);
  return {
    voucherTerms: {
      code: voucher.code,
      percentage: voucher.percentage,
      active: voucher.active,
      validFrom: voucher.valid_from,
      validUntil: voucher.valid_until,
      maxUses: voucher.max_uses,
      reimbursementCents: voucher.reimbursement_value_cents,
      requiresVerification: voucher.requires_verification,
      ...((hasAdvancedVoucherTerms(voucher) || effectiveMonths > 0) ? {
        extensionMonths: effectiveMonths,
        eligibleDurationKeys: voucher.eligible_duration_keys,
        eligibleMembershipTypes: voucher.eligible_membership_types,
        eligibleApplicationKinds: voucher.eligible_application_kinds,
        eligibleGymIds: voucher.eligible_gym_ids,
      } : {}),
    },
    applicationId: application.id,
    membershipType: application.membership_type,
    durationKey: application.duration_key,
    applicationKind: application.application_kind,
    gymId: application.enrollment_gym_id,
    startDate: application.start_date,
    baseExpiryDate: application.expiry_date,
    basePriceCents: application.base_price_cents,
    priceCatalogVersionId: application.price_catalog_version_id,
    accessScope: application.access_scope,
    accessGymId: application.access_gym_id,
  };
}

function filterList(value: unknown, label: string, allowed?: readonly string[]): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim() || (allowed && !allowed.includes(item)))) {
    throw new Error("Invalid eligible " + label + ".");
  }
  return value.length ? [...new Set(value as string[])].sort() : null;
}

export function parseVoucherPromotion(body: Record<string, unknown>): VoucherPromotion {
  const months = body.extensionMonths === undefined ? 0 : Number(body.extensionMonths);
  if (!Number.isInteger(months) || months < 0 || months > 120) {
    throw new Error("Free months must be a whole number from 0 to 120.");
  }
  const durationKeys = filterList(body.eligibleDurationKeys, "durations", ["1_session", "1_week", "2_weeks", "1_month", "3_months", "6_months", "1_year"]);
  if (months > 0 && durationKeys?.includes("1_session")) throw new Error("Duration vouchers cannot extend a single gym session.");
  return {
    extension_months: months,
    eligible_duration_keys: durationKeys,
    eligible_membership_types: filterList(body.eligibleMembershipTypes, "membership categories", ["single", "student", "couples"]),
    eligible_application_kinds: filterList(body.eligibleApplicationKinds, "application kinds", ["new", "renewal"]),
    eligible_gym_ids: filterList(body.eligibleGymIds, "gyms"),
  };
}
