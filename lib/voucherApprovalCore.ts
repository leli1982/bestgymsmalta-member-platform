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
    stored.requiresVerification === current.requiresVerification
  );
}

export function voucherApprovalTermsFromRow(row: {
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  reimbursement_value_cents: number | null;
  requires_verification: boolean;
}): VoucherApprovalTerms {
  return {
    code: row.code,
    percentage: row.percentage,
    active: row.active,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    maxUses: row.max_uses,
    reimbursementCents: row.reimbursement_value_cents,
    requiresVerification: row.requires_verification,
  };
}
