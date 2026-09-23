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
