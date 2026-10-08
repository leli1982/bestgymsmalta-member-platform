import { visitMaltaDate } from "./scanVisitStatsCore";

export type VoucherEligibilityPeriod = {
  startDate: string;
  endDate: string;
};

export type VoucherAttendanceCheckin = {
  id: string;
  memberId: string;
  gymId: string;
  gymName: string;
  checkinAt: string;
};

export type VoucherGymBreakdown = {
  gymId: string;
  gymName: string;
  visits: number;
};

export type VoucherAttendanceSummary = {
  eligibleDays: number;
  attendedDays: number;
  missedDays: number;
  attendancePercentage: number;
  totalVisits: number;
  lastVisitAt: string | null;
  gymBreakdown: VoucherGymBreakdown[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateToOrdinal(value: string) {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utc).toISOString().slice(0, 10);
  if (roundTrip !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return Math.floor(utc / 86_400_000);
}

function ordinalToDate(ordinal: number) {
  return new Date(ordinal * 86_400_000).toISOString().slice(0, 10);
}

function eligibleDateSet({
  reportFrom,
  reportTo,
  eligibility,
}: {
  reportFrom: string;
  reportTo: string;
  eligibility: VoucherEligibilityPeriod[];
}) {
  const reportFromOrdinal = dateToOrdinal(reportFrom);
  const reportToOrdinal = dateToOrdinal(reportTo);
  if (reportFromOrdinal > reportToOrdinal) {
    throw new Error("Invalid report range: reportFrom must not be after reportTo.");
  }

  const dates = new Set<string>();
  for (const period of eligibility) {
    const startOrdinal = dateToOrdinal(period.startDate);
    const endOrdinal = dateToOrdinal(period.endDate);
    if (startOrdinal > endOrdinal) continue;

    const clippedStart = Math.max(startOrdinal, reportFromOrdinal);
    const clippedEnd = Math.min(endOrdinal, reportToOrdinal);
    for (let cursor = clippedStart; cursor <= clippedEnd; cursor += 1) {
      dates.add(ordinalToDate(cursor));
    }
  }

  return dates;
}

export function voucherAttendanceStatus({
  eligibleDays,
  attendedDays,
}: {
  eligibleDays: number;
  attendedDays: number;
}) {
  if (eligibleDays <= 0) return "not-eligible" as const;
  if (attendedDays <= 0) return "no-show" as const;
  return "attended" as const;
}

export function summariseVoucherAttendance({
  reportFrom,
  reportTo,
  eligibility,
  checkins,
}: {
  reportFrom: string;
  reportTo: string;
  eligibility: VoucherEligibilityPeriod[];
  checkins: VoucherAttendanceCheckin[];
}): VoucherAttendanceSummary {
  const eligibleDates = eligibleDateSet({ reportFrom, reportTo, eligibility });
  const attendedDates = new Set<string>();
  const gymVisits = new Map<string, VoucherGymBreakdown>();
  const qualifyingCheckins: VoucherAttendanceCheckin[] = [];

  for (const checkin of checkins) {
    const maltaDate = visitMaltaDate(checkin.checkinAt);
    if (!eligibleDates.has(maltaDate)) continue;

    attendedDates.add(maltaDate);
    qualifyingCheckins.push(checkin);

    const gymKey = checkin.gymId || checkin.gymName;
    const existing = gymVisits.get(gymKey);
    if (existing) {
      existing.visits += 1;
    } else {
      gymVisits.set(gymKey, {
        gymId: checkin.gymId,
        gymName: checkin.gymName,
        visits: 1,
      });
    }
  }

  qualifyingCheckins.sort(
    (left, right) => new Date(left.checkinAt).getTime() - new Date(right.checkinAt).getTime()
  );

  const eligibleDays = eligibleDates.size;
  const attendedDays = attendedDates.size;
  const missedDays = Math.max(0, eligibleDays - attendedDays);
  const attendancePercentage = eligibleDays
    ? Math.round((attendedDays / eligibleDays) * 1_000) / 10
    : 0;

  return {
    eligibleDays,
    attendedDays,
    missedDays,
    attendancePercentage,
    totalVisits: qualifyingCheckins.length,
    lastVisitAt: qualifyingCheckins.at(-1)?.checkinAt ?? null,
    gymBreakdown: Array.from(gymVisits.values()).sort(
      (left, right) => right.visits - left.visits || left.gymName.localeCompare(right.gymName)
    ),
  };
}
