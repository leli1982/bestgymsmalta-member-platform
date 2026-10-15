export type MemberAppAccessState = "active" | "grace" | "locked";

export type MemberAppAccessResult = {
  state: MemberAppAccessState;
  daysUntilExpiry: number;
  graceDaysRemaining: number;
  reminderDue: boolean;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const GRACE_DAYS = 7;

function calendarOrdinal(value: string) {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const millis = Date.UTC(year, month - 1, day);
  if (new Date(millis).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return Math.floor(millis / DAY_MS);
}

function normalizedReminderDays(values: number[]) {
  return new Set(
    values.filter((value) => Number.isInteger(value) && value > 0)
  );
}

export function evaluateMemberAppAccess({
  today,
  status,
  membershipExpiry,
  reminderDays,
  cancellationEffective = false,
}: {
  today: string;
  status: string | null | undefined;
  membershipExpiry: string;
  reminderDays: number[];
  cancellationEffective?: boolean;
}): MemberAppAccessResult {
  const todayOrdinal = calendarOrdinal(today);
  const expiryOrdinal = calendarOrdinal(membershipExpiry);
  const daysUntilExpiry = expiryOrdinal - todayOrdinal;

  if (String(status || "").trim().toLowerCase() !== "active" || cancellationEffective) {
    return {
      state: "locked",
      daysUntilExpiry,
      graceDaysRemaining: 0,
      reminderDue: false,
    };
  }

  if (daysUntilExpiry >= 0) {
    return {
      state: "active",
      daysUntilExpiry,
      graceDaysRemaining: 0,
      reminderDue:
        daysUntilExpiry === 0 ||
        (daysUntilExpiry > 0 && normalizedReminderDays(reminderDays).has(daysUntilExpiry)),
    };
  }

  const daysAfterExpiry = Math.abs(daysUntilExpiry);
  if (daysAfterExpiry <= GRACE_DAYS) {
    return {
      state: "grace",
      daysUntilExpiry,
      graceDaysRemaining: GRACE_DAYS - daysAfterExpiry + 1,
      reminderDue: false,
    };
  }

  return {
    state: "locked",
    daysUntilExpiry,
    graceDaysRemaining: 0,
    reminderDue: false,
  };
}
