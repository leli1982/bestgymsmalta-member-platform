export type DateEditEligibility = {
  allowed: boolean;
  reason: string;
  membershipId: string | null;
  expectedMembershipUpdatedAt: string | null;
  startDate: string;
  expiryDate: string;
};

export type LinkedMembershipForDates = {
  id: string;
  status: string;
  start_date: string;
  expiry_date: string;
  updated_at: string;
  participantCount: number;
};

export function validMembershipDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveMemberDateEdit(
  expiry: string | null,
  legacyStart: string | null,
  memberships: LinkedMembershipForDates[]
): DateEditEligibility {
  const base = { expiryDate: expiry || "", startDate: legacyStart || "",
    membershipId: null, expectedMembershipUpdatedAt: null };
  if (!memberships.length) return {
    ...base, allowed: true, reason: "Legacy member: start date is optional. Only enter a historically verified start date.",
  };
  if (!expiry) return {
    ...base, allowed: false, reason: "This member has linked membership history but no recorded current expiry. Review their record before editing.",
  };
  const matching = memberships.filter((membership) =>
    membership.status !== "cancelled" && membership.expiry_date === expiry);
  if (matching.length !== 1) return {
    ...base, allowed: false,
    reason: "The current membership cannot be identified unambiguously from this member’s expiry date. Review the linked membership records before editing.",
  };
  const current = matching[0];
  if (current.participantCount !== 1 || current.status === "cancelled") return {
    ...base, allowed: false,
    reason: "This is a shared membership. Dates must be changed for both members together in a separate audited action.",
  };
  return {
    allowed: true, reason: "Current individual membership identified. Original payment and application records will remain unchanged.",
    membershipId: current.id, expectedMembershipUpdatedAt: current.updated_at,
    startDate: current.start_date, expiryDate: current.expiry_date,
  };
}

export function validateMembershipDateEdit(value: unknown): 
  | { ok: true; startDate: string | null; expiryDate: string; membershipId: string | null; expectedMemberUpdatedAt: string; expectedMembershipUpdatedAt: string | null }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, error: "Invalid membership date edit." };
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "expectedMemberUpdatedAt,expectedMembershipUpdatedAt,expiryDate,membershipId,startDate")
    return { ok: false, error: "Only membership dates may be updated here." };
  const validTimestamp = (stamp: unknown) => typeof stamp === "string" && Boolean(stamp) && Number.isFinite(Date.parse(stamp));
  if (!validTimestamp(data.expectedMemberUpdatedAt) || (data.membershipId !== null &&
    (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data.membershipId))
      || !validTimestamp(data.expectedMembershipUpdatedAt)))
    || (data.membershipId === null && data.expectedMembershipUpdatedAt !== null))
    return { ok: false, error: "Reload the member before editing dates." };
  const startDate = data.startDate === "" || data.startDate === null ? null : data.startDate;
  if ((startDate !== null && !validMembershipDate(startDate)) || !validMembershipDate(data.expiryDate))
    return { ok: false, error: "Enter valid calendar dates and an expiry date." };
  if (data.membershipId !== null && startDate === null)
    return { ok: false, error: "A linked membership must have a start date." };
  if (startDate && startDate > data.expiryDate)
    return { ok: false, error: "Expiry date cannot be earlier than the verified start date." };
  return { ok: true, startDate, expiryDate: data.expiryDate,
    membershipId: data.membershipId as string | null,
    expectedMemberUpdatedAt: data.expectedMemberUpdatedAt as string,
    expectedMembershipUpdatedAt: data.expectedMembershipUpdatedAt as string | null };
}
