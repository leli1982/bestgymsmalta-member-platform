import { todayMaltaDate } from "./maltaDate.ts";

export const ENGAGEMENT_STREAK_MILESTONES = [3, 5, 7, 14, 30] as const;
export const ENGAGEMENT_INACTIVITY_DAYS = 3;

export type EngagementEvent = {
  eventType: "inactivity" | "streak";
  eventKey: string;
  eventDate: string;
  title: string;
  body: string;
  href: "/gyms" | "/passport";
};

type CheckinLike = {
  checkin_at?: string | null;
  source?: string | null;
};

const CANONICAL_SOURCES = new Set(["qr", "nfc", "barcode"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function calendarOrdinal(value: string) {
  if (!ISO_DATE_RE.test(value)) throw new Error(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const millis = Date.UTC(year, month - 1, day);
  if (new Date(millis).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return Math.floor(millis / DAY_MS);
}

function dayDistance(from: string, to: string) {
  return calendarOrdinal(to) - calendarOrdinal(from);
}

function uniqueSortedDates(values: string[]) {
  return [...new Set(values)].sort();
}

export function attendanceDatesFromCheckins(checkins: CheckinLike[]): string[] {
  return uniqueSortedDates(
    checkins.flatMap((checkin) => {
      const source = String(checkin.source || "").trim().toLowerCase();
      if (!CANONICAL_SOURCES.has(source)) return [];
      const instant = String(checkin.checkin_at || "").trim();
      const date = new Date(instant);
      if (!instant || !Number.isFinite(date.getTime())) return [];
      return [todayMaltaDate(date)];
    }),
  );
}

export function buildInactivityEvent(
  attendanceDates: string[],
  businessDate: string,
): EngagementEvent | null {
  const dates = uniqueSortedDates(attendanceDates);
  const latest = dates.at(-1);
  if (!latest || dayDistance(latest, businessDate) !== ENGAGEMENT_INACTIVITY_DAYS) return null;
  return {
    eventType: "inactivity",
    eventKey: `inactivity:${latest}`,
    eventDate: businessDate,
    title: "We miss you at BGM 💪",
    body: "It’s been 3 days since your last workout. Ready for the next one?",
    href: "/gyms",
  };
}

function streakCopy(milestone: number) {
  switch (milestone) {
    case 3:
      return { title: "3-day streak 🔥", body: "Three days in a row. Keep that momentum going!" };
    case 5:
      return { title: "5 days strong 💪", body: "Five days in a row. Your consistency is building!" };
    case 7:
      return { title: "One full week! 🔥", body: "Seven consecutive training days. That is serious momentum!" };
    case 14:
      return { title: "14-day streak — serious consistency 👏", body: "Two straight weeks of showing up. Keep it going!" };
    case 30:
      return { title: "30 days. Outstanding consistency 🏆", body: "Thirty consecutive attendance days. Outstanding work!" };
    default:
      throw new Error("Unsupported streak milestone.");
  }
}

export function buildStreakEvent(
  attendanceDates: string[],
  businessDate: string,
): EngagementEvent | null {
  const dates = uniqueSortedDates(attendanceDates);
  const latest = dates.at(-1);
  if (!latest) return null;

  const freshness = dayDistance(latest, businessDate);
  if (freshness < 0 || freshness > 1) return null;

  let streakLength = 1;
  let streakStart = latest;
  for (let index = dates.length - 2; index >= 0; index -= 1) {
    const candidate = dates[index];
    if (dayDistance(candidate, streakStart) !== 1) break;
    streakStart = candidate;
    streakLength += 1;
  }

  if (!(ENGAGEMENT_STREAK_MILESTONES as readonly number[]).includes(streakLength)) return null;
  const copy = streakCopy(streakLength);
  return {
    eventType: "streak",
    eventKey: `streak:${streakStart}:${streakLength}`,
    eventDate: latest,
    title: copy.title,
    body: copy.body,
    href: "/passport",
  };
}

export function evaluateMotivationalEligibility(input: {
  appEnrolled: boolean;
  archivedAt: string | null;
  status: string | null;
  membershipExpiry: string | null;
  cancellationEffectiveDate: string | null;
  today: string;
  motivationalEnabled: boolean;
  hasActiveSubscription: boolean;
}): { eligible: boolean; reason: string | null } {
  if (!input.appEnrolled) return { eligible: false, reason: "app_not_activated" };
  if (input.archivedAt) return { eligible: false, reason: "archived" };
  if (String(input.status || "").trim().toLowerCase() !== "active") {
    return { eligible: false, reason: "inactive" };
  }
  if (!input.membershipExpiry || input.membershipExpiry < input.today) {
    return { eligible: false, reason: "membership_expired" };
  }
  if (input.cancellationEffectiveDate && input.cancellationEffectiveDate <= input.today) {
    return { eligible: false, reason: "cancellation_effective" };
  }
  if (!input.motivationalEnabled) return { eligible: false, reason: "motivational_disabled" };
  if (!input.hasActiveSubscription) return { eligible: false, reason: "no_push_subscription" };
  return { eligible: true, reason: null };
}
