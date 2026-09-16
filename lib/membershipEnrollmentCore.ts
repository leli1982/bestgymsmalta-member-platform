import type { MembershipDurationKey } from "@/lib/membershipSettingsCore";

export type MembershipEnrollmentKind = "new" | "renewal";

export function buildEnrollmentIdentityAction(input: {
  kind: string;
  existingMemberId?: string | null;
}) {
  const kind = String(input.kind || "").trim().toLowerCase();
  const existingMemberId = String(input.existingMemberId || "").trim();

  if (kind === "new") {
    return { kind: "create_person" } as const;
  }

  if (kind === "renewal") {
    if (!existingMemberId) {
      throw new Error("Renewal requires an existing member.");
    }

    return { kind: "reuse_person", memberId: existingMemberId } as const;
  }

  throw new Error("Enrollment kind must be new or renewal.");
}

export function requireStaffName(value: unknown, label = "Staff Name") {
  const staffName = String(value ?? "").trim();
  if (!staffName) {
    throw new Error(`${label} is required.`);
  }
  return staffName;
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    throw new Error("Membership start date must be a valid YYYY-MM-DD date.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Membership start date must be a valid calendar date.");
  }

  return date;
}

export function calculateMembershipExpiry(
  startDate: string,
  durationKey: MembershipDurationKey,
): string {
  const date = parseIsoDate(startDate);

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

  return date.toISOString().slice(0, 10);
}
