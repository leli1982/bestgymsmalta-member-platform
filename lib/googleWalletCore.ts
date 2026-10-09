import { maltaDayUtcRange, maltaMidnightUtc } from "./maltaDate.ts";

export type GoogleWalletEligibilityReason =
  | "archived"
  | "inactive"
  | "cancelled"
  | "expired"
  | "card_missing"
  | "membership_missing";

export type GoogleWalletMemberSnapshot = {
  memberId: string;
  fullName: string;
  memberNumber: string;
  status: string;
  membershipExpiry: string | null;
  cancellationEffectiveDate: string | null;
  archivedAt: string | null;
  activeCardBarcode: string | null;
};

export type GoogleWalletBarcode =
  | { type: "CODE_128"; value: string; alternateText: string }
  | { type: "TEXT_ONLY"; value: string };

export type GoogleWalletProjection = {
  eligibleToAdd: boolean;
  reason: GoogleWalletEligibilityReason | null;
  genericType: "GENERIC_GYM_MEMBERSHIP";
  state: "ACTIVE" | "INACTIVE" | "EXPIRED";
  memberId: string;
  fullName: string;
  memberNumber: string;
  expiryDate: string | null;
  expiryDisplay: string | null;
  validTimeIntervalEnd: string | null;
  barcode: GoogleWalletBarcode;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function displayDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function textBarcode(value: string): GoogleWalletBarcode {
  return { type: "TEXT_ONLY", value };
}

export function googleWalletObjectSuffix(memberId: string, prefix: string): string {
  return `${clean(prefix)}member_${clean(memberId)}`;
}

export function googleWalletClassId(issuerId: string, classSuffix: string): string {
  return `${clean(issuerId)}.${clean(classSuffix)}`;
}

export function googleWalletObjectId(
  issuerId: string,
  memberId: string,
  prefix: string,
): string {
  return `${clean(issuerId)}.${googleWalletObjectSuffix(memberId, prefix)}`;
}

export function googleWalletValidityEnd(
  expiryDate: string | null,
  cancellationEffectiveDate: string | null,
): string | null {
  const expiryEnd = expiryDate ? maltaDayUtcRange(expiryDate).end : null;
  const cancellationEnd = cancellationEffectiveDate
    ? maltaMidnightUtc(cancellationEffectiveDate)
    : null;

  if (expiryEnd && cancellationEnd) {
    return expiryEnd <= cancellationEnd ? expiryEnd : cancellationEnd;
  }
  return expiryEnd || cancellationEnd;
}

export function projectGoogleWalletMember(
  snapshot: GoogleWalletMemberSnapshot,
  today: string,
): GoogleWalletProjection {
  const base = {
    genericType: "GENERIC_GYM_MEMBERSHIP" as const,
    memberId: snapshot.memberId,
    fullName: snapshot.fullName,
    memberNumber: snapshot.memberNumber,
    expiryDate: snapshot.membershipExpiry,
    expiryDisplay: displayDate(snapshot.membershipExpiry),
    validTimeIntervalEnd: googleWalletValidityEnd(
      snapshot.membershipExpiry,
      snapshot.cancellationEffectiveDate,
    ),
  };

  if (snapshot.archivedAt) {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "archived",
      state: "INACTIVE",
      barcode: textBarcode("Membership inactive"),
    };
  }

  if (clean(snapshot.status).toLowerCase() !== "active") {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "inactive",
      state: "INACTIVE",
      barcode: textBarcode("Membership inactive"),
    };
  }

  if (
    snapshot.cancellationEffectiveDate &&
    snapshot.cancellationEffectiveDate <= today
  ) {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "cancelled",
      state: "INACTIVE",
      barcode: textBarcode("Membership inactive"),
    };
  }

  if (!snapshot.membershipExpiry) {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "membership_missing",
      state: "INACTIVE",
      barcode: textBarcode("Membership inactive"),
    };
  }

  if (snapshot.membershipExpiry < today) {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "expired",
      state: "EXPIRED",
      barcode: textBarcode("Membership expired"),
    };
  }

  const activeCardBarcode = clean(snapshot.activeCardBarcode);
  if (!activeCardBarcode) {
    return {
      ...base,
      eligibleToAdd: false,
      reason: "card_missing",
      state: "INACTIVE",
      barcode: textBarcode("Card unavailable"),
    };
  }

  return {
    ...base,
    eligibleToAdd: true,
    reason: null,
    state: "ACTIVE",
    barcode: {
      type: "CODE_128",
      value: activeCardBarcode,
      alternateText: activeCardBarcode,
    },
  };
}
