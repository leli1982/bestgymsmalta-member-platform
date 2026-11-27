import { isValidCalendarDate, todayMaltaDate } from "./maltaDate.ts";

/**
 * Display-only, Staff Portal warning. This does not change access decisions,
 * check-ins, renewal dates, membership pricing or member email reminders.
 * A granted member is due soon on their expiry day and the preceding 7 days.
 */
export function getGrantedRenewalDaysRemaining(
  granted: boolean,
  expiryDate: string | null | undefined,
  today: string = todayMaltaDate(),
): number | null {
  if (!granted || !expiryDate || !isValidCalendarDate(expiryDate) || !isValidCalendarDate(today)) {
    return null;
  }

  const dayNumber = (value: string) => Date.UTC(
    Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)),
  ) / 86_400_000;
  const days = dayNumber(expiryDate) - dayNumber(today);
  return days >= 0 && days <= 7 ? days : null;
}

/** Only a verified, online, genuinely expired scan can open the existing renewal flow. */
export function getExpiredScanRenewalHref(
  scan: { result: string; granted: boolean; offline?: boolean; cardMatches?: readonly unknown[]; member?: { memberNumber: string } | null } | null | undefined,
  user: { gymId: string | null; isSuperAdmin: boolean; permissions: string[] } | null | undefined,
): string | null {
  if (!user?.gymId || (!user.isSuperAdmin && !(user.permissions.includes("members.renew") && user.permissions.includes("members.view")))) return null;
  if (!scan || scan.granted || scan.offline || scan.result !== "expired" || scan.cardMatches?.length || !scan.member?.memberNumber) return null;
  return `/staff/members/enroll?kind=renewal&memberNumber=${encodeURIComponent(scan.member.memberNumber)}`;
}
