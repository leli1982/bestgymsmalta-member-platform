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
