import { effectiveVoucherExtension, type TimedVoucherBonus } from "@/lib/voucherDurationCore";
import { todayMaltaDate } from "@/lib/maltaDate";

export type VoucherApprovalStatus = "not_required" | "not_requested" | "pending" | "approved" | "rejected" | "stale";

export type VoucherApprovalTerms = {
  code: string;
  percentage: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  reimbursementCents: number | null;
  requiresVerification: boolean;
  extensionMonths?: number;
  eligibleDurationKeys?: string[] | null;
  eligibleMembershipTypes?: string[] | null;
  eligibleApplicationKinds?: string[] | null;
  eligibleGymIds?: string[] | null;
};

export function matchingVoucherApprovalTerms(
  stored: VoucherApprovalTerms | null | undefined,
  current: VoucherApprovalTerms
): boolean {
  return !!stored && (
    stored.code === current.code &&
    stored.percentage === current.percentage &&
    stored.active === current.active &&
    stored.validFrom === current.validFrom &&
    stored.validUntil === current.validUntil &&
    stored.maxUses === current.maxUses &&
    stored.reimbursementCents === current.reimbursementCents &&
    stored.requiresVerification === current.requiresVerification &&
    (stored.extensionMonths || 0) === (current.extensionMonths || 0) &&
    JSON.stringify(stored.eligibleDurationKeys ?? null) === JSON.stringify(current.eligibleDurationKeys ?? null) &&
    JSON.stringify(stored.eligibleMembershipTypes ?? null) === JSON.stringify(current.eligibleMembershipTypes ?? null) &&
    JSON.stringify(stored.eligibleApplicationKinds ?? null) === JSON.stringify(current.eligibleApplicationKinds ?? null) &&
    JSON.stringify(stored.eligibleGymIds ?? null) === JSON.stringify(current.eligibleGymIds ?? null)
  );
}

export function voucherApprovalTermsFromRow(row: TimedVoucherBonus & {
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  reimbursement_value_cents: number | null;
  requires_verification: boolean;
  extension_months?: number;
  eligible_duration_keys?: string[] | null;
  eligible_membership_types?: string[] | null;
  eligible_application_kinds?: string[] | null;
  eligible_gym_ids?: string[] | null;
}): VoucherApprovalTerms {
  const effectiveMonths = effectiveVoucherExtension(row, todayMaltaDate());
  return {
    code: row.code,
    percentage: row.percentage,
    active: row.active,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    maxUses: row.max_uses,
    reimbursementCents: row.reimbursement_value_cents,
    requiresVerification: row.requires_verification,
    ...((effectiveMonths || row.eligible_duration_keys || row.eligible_membership_types ||
      row.eligible_application_kinds || row.eligible_gym_ids) ? {
      extensionMonths: effectiveMonths,
      eligibleDurationKeys: row.eligible_duration_keys ?? null,
      eligibleMembershipTypes: row.eligible_membership_types ?? null,
      eligibleApplicationKinds: row.eligible_application_kinds ?? null,
      eligibleGymIds: row.eligible_gym_ids ?? null,
    } : {}),
  };
}
