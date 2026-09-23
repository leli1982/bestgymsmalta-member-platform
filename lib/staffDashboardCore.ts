import { evaluateBarcodeAccess } from "./barcodeAccessCore.ts";

export type StaffMemberClassification = "active" | "expired" | "inactive";
export type StaffMemberFilter = "all" | "active" | "expired";

export function classifyStaffMember(input: {
  status?: string | null;
  membershipExpiry?: string | null;
  cancellationEffectiveDate?: string | null;
  today: string;
}): StaffMemberClassification {
  const result = evaluateBarcodeAccess({
    member: {
      status: input.status,
      membershipExpiry: input.membershipExpiry,
      cancellationEffectiveDate: input.cancellationEffectiveDate,
    },
    today: input.today,
  }).result;

  if (result === "granted") return "active";
  if (result === "expired") return "expired";
  return "inactive";
}

export function matchesStaffMemberFilter(
  classification: StaffMemberClassification,
  filter: StaffMemberFilter
) {
  if (filter === "all") return true;
  return classification === filter;
}

export function sortPendingApplicationsNewestFirst<
  T extends { submittedAt: string | null; createdAt: string },
>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.submittedAt || left.createdAt);
    const rightTime = Date.parse(right.submittedAt || right.createdAt);
    return rightTime - leftTime;
  });
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMaltaDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const monthIndex = Number.parseInt(pick("month"), 10) - 1;
  const month = MONTHS[monthIndex] || "";
  return `${pick("day")} ${month} ${pick("year")} · ${pick("hour")}:${pick("minute")}`;
}
