import { validMembershipDate } from "./memberDateEditCore.ts";

export type CancellationEligibility = {
  allowed: boolean;
  reason: string;
  membershipId: string | null;
  expectedMembershipUpdatedAt: string | null;
  effectiveDate: string | null;
  canWithdraw: boolean;
};

export type MemberCancellationContext = {
  memberStatus: string;
  membershipExpiry: string | null;
  cancellationEffectiveDate: string | null;
  today: string;
  memberships: Array<{
    id: string;
    status: string;
    expiry_date: string;
    updated_at: string;
    participantCount: number;
  }>;
};

export function isCancellationEffective(effectiveDate: string | null | undefined, today: string) {
  return Boolean(effectiveDate && effectiveDate <= today);
}

export function resolveMemberCancellation(context: MemberCancellationContext): CancellationEligibility {
  const { memberStatus, membershipExpiry, cancellationEffectiveDate, today, memberships } = context;
  const base = { membershipId: null, expectedMembershipUpdatedAt: null,
    effectiveDate: cancellationEffectiveDate || null,
    canWithdraw: Boolean(cancellationEffectiveDate && cancellationEffectiveDate > today) };
  if (isCancellationEffective(cancellationEffectiveDate, today)) {
    return { ...base, allowed: false, reason: "Cancellation has already taken effect. A new membership requires the authorised renewal process." };
  }
  if (memberStatus !== "active") {
    return { ...base, allowed: false, reason: "This member is not active. Use the appropriate renewal or account-status action." };
  }
  if (membershipExpiry && membershipExpiry < today) {
    return { ...base, allowed: false, reason: "This membership has already expired. Use the renewal process instead." };
  }
  if (!memberships.length) {
    return { ...base, allowed: true, reason: "Legacy membership: cancellation affects this member only. Historical start dates and original Excel data are unchanged." };
  }
  const current = memberships.filter(row =>
    row.status !== "cancelled" && row.expiry_date === membershipExpiry);
  if (current.length !== 1) {
    return { ...base, allowed: false, reason: "Current linked membership is ambiguous. Review linked membership history first." };
  }
  if (current[0].participantCount !== 1) {
    return { ...base, allowed: false, reason: "Shared couples membership: cancellation requires a separately approved joint action, never an individual edit." };
  }
  return { ...base, allowed: true, reason: "Current individual membership verified. Cancellation does not alter original expiry dates or payments.",
    membershipId: current[0].id, expectedMembershipUpdatedAt: current[0].updated_at };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates route member IDs with the same five UUID groups used in payloads. */
export function isMemberUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
const validTimestamp = (value: unknown) =>
  typeof value === "string" && Boolean(value) && Number.isFinite(Date.parse(value));

export function validateCancellationCommand(value: unknown):
  | { ok: true; action: "cancel" | "withdraw"; effectiveDate: string | null;
      reason: string; membershipId: string | null; expectedMemberUpdatedAt: string;
      expectedMembershipUpdatedAt: string | null }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid cancellation request." };
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !==
    "action,effectiveDate,expectedMemberUpdatedAt,expectedMembershipUpdatedAt,membershipId,reason") {
    return { ok: false, error: "Only cancellation fields may be submitted." };
  }
  if (input.action !== "cancel" && input.action !== "withdraw") {
    return { ok: false, error: "Choose cancellation or withdrawal of a pending cancellation." };
  }
  if (!validTimestamp(input.expectedMemberUpdatedAt)
    || (input.membershipId !== null && (!uuid.test(String(input.membershipId))
      || !validTimestamp(input.expectedMembershipUpdatedAt)))
    || (input.membershipId === null && input.expectedMembershipUpdatedAt !== null)) {
    return { ok: false, error: "Reload the member before changing their cancellation." };
  }
  if (typeof input.reason !== "string" || input.reason.trim().length > 500) {
    return { ok: false, error: "Cancellation notes must be at most 500 characters." };
  }
  if (input.action === "cancel" && !validMembershipDate(input.effectiveDate)) {
    return { ok: false, error: "Choose a valid cancellation effective date." };
  }
  if (input.action === "withdraw" && input.effectiveDate !== null) {
    return { ok: false, error: "A withdrawal does not accept a new effective date." };
  }
  return { ok: true, action: input.action, effectiveDate: input.effectiveDate as string | null,
    reason: input.reason.trim(), membershipId: input.membershipId as string | null,
    expectedMemberUpdatedAt: input.expectedMemberUpdatedAt as string,
    expectedMembershipUpdatedAt: input.expectedMembershipUpdatedAt as string | null };
}

/** The joint command names both people but never trusts the caller to supply their relationship. */
export type CouplesCancellationContext = {
  memberStatus: string; partnerStatus: string;
  memberExpiry: string | null; partnerExpiry: string | null;
  membershipExpiry: string; membershipStatus: string;
  memberEffectiveDate: string | null; partnerEffectiveDate: string | null;
  membershipEffectiveDate: string | null; today: string;
  memberCurrentMatches: number; partnerCurrentMatches: number;
};
export function resolveCouplesCancellation(context: CouplesCancellationContext) {
  const c = context;
  const synchronized = c.memberEffectiveDate === c.partnerEffectiveDate
    && c.memberEffectiveDate === c.membershipEffectiveDate;
  const canWithdraw = Boolean(c.memberEffectiveDate && c.memberEffectiveDate > c.today && synchronized);
  if (c.memberCurrentMatches !== 1 || c.partnerCurrentMatches !== 1
    || c.memberExpiry !== c.membershipExpiry || c.partnerExpiry !== c.membershipExpiry) {
    return { allowed: false, canWithdraw: false, reason: "The current membership relationship is ambiguous. Review both members before changing it." };
  }
  if (!synchronized) return { allowed: false, canWithdraw: false, reason: "The partners have inconsistent cancellation history. Review their records before continuing." };
  if (isCancellationEffective(c.memberEffectiveDate, c.today))
    return { allowed: false, canWithdraw: false, reason: "Cancellation has taken effect. Use an authorised new-membership process." };
  if (c.memberStatus !== "active" || c.partnerStatus !== "active"
    || c.membershipStatus !== "active" || c.membershipExpiry < c.today)
    return { allowed: false, canWithdraw: false, reason: "Both partners and the shared membership must be active and unexpired." };
  return { allowed: true, canWithdraw,
    reason: "Joint action: both partners and the shared couples membership will be updated together and audited separately." };
}

export function validateCouplesCancellationCommand(value: unknown):
  | { ok: true; action: "cancel" | "withdraw"; effectiveDate: string | null;
      reason: string; membershipId: string; partnerId: string;
      expectedMemberUpdatedAt: string; expectedPartnerUpdatedAt: string;
      expectedMembershipUpdatedAt: string }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, error: "Invalid joint cancellation request." };
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !==
    "action,effectiveDate,expectedMemberUpdatedAt,expectedMembershipUpdatedAt,expectedPartnerUpdatedAt,membershipId,partnerId,reason")
    return { ok: false, error: "Only joint cancellation fields may be submitted." };
  if (data.action !== "cancel" && data.action !== "withdraw")
    return { ok: false, error: "Choose cancellation or withdrawal." };
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const stamp = (x: unknown) => typeof x === "string" && Boolean(x) && Number.isFinite(Date.parse(x));
  if (!id.test(String(data.membershipId)) || !id.test(String(data.partnerId))
    || !stamp(data.expectedMemberUpdatedAt) || !stamp(data.expectedPartnerUpdatedAt)
    || !stamp(data.expectedMembershipUpdatedAt))
    return { ok: false, error: "Reload both members before changing their shared membership." };
  if (typeof data.reason !== "string" || data.reason.trim().length > 500)
    return { ok: false, error: "Cancellation notes must be at most 500 characters." };
  if (data.action === "cancel" && !validMembershipDate(data.effectiveDate))
    return { ok: false, error: "Choose a valid cancellation effective date." };
  if (data.action === "withdraw" && data.effectiveDate !== null)
    return { ok: false, error: "Withdrawal cannot set an effective date." };
  return { ok: true, action: data.action,
    effectiveDate: data.effectiveDate as string | null,
    reason: data.reason.trim(), membershipId: data.membershipId as string,
    partnerId: data.partnerId as string,
    expectedMemberUpdatedAt: data.expectedMemberUpdatedAt as string,
    expectedPartnerUpdatedAt: data.expectedPartnerUpdatedAt as string,
    expectedMembershipUpdatedAt: data.expectedMembershipUpdatedAt as string };
}
