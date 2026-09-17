import type { MembershipDurationKey } from "@/lib/membershipSettingsCore";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) throw new Error("A valid YYYY-MM-DD date is required.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error("A valid calendar date is required.");
  }

  return { year, month, day };
}

function formatCalendarDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayMaltaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  if (!year || !month || !day) throw new Error("Could not resolve the Malta business date.");
  return `${year}-${month}-${day}`;
}

export function addMembershipDurationDate(
  startDate: string,
  durationKey: MembershipDurationKey,
): string {
  const parsed = parseCalendarDate(startDate);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));

  switch (durationKey) {
    case "1_week":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "2_weeks":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case "1_month":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "3_months":
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
    case "6_months":
      date.setUTCMonth(date.getUTCMonth() + 6);
      break;
    case "1_year":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    default:
      throw new Error("Unsupported membership duration.");
  }

  return formatCalendarDate(date);
}
