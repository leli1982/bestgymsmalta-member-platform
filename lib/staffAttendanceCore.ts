import { maltaDayUtcRange, todayMaltaDate } from "./maltaDate.ts";

export type StaffEmploymentType = "full_time" | "part_time";

export type EffectiveRow = {
  effectiveFrom: string;
};

export type MaltaSessionSlice = {
  calendarDate: string;
  startsAt: Date;
  endsAt: Date;
  workedMinutes: number;
};

export function effectiveRecordOn<T extends EffectiveRow>(
  rows: readonly T[],
  date: string
): T | null {
  let selected: T | null = null;
  for (const row of rows) {
    if (row.effectiveFrom > date) continue;
    if (!selected || row.effectiveFrom > selected.effectiveFrom) selected = row;
  }
  return selected;
}

export function holidayMultiplierBps(
  holiday: {
    fullTimeMultiplierBps: number;
    partTimeMultiplierBps: number;
  } | null,
  employmentType: StaffEmploymentType
): number {
  if (!holiday) return 10000;
  return employmentType === "full_time"
    ? holiday.fullTimeMultiplierBps
    : holiday.partTimeMultiplierBps;
}

export function normalizePunchMinute(value: Date): Date {
  const normalized = new Date(value.getTime());
  normalized.setUTCSeconds(0, 0);
  return normalized;
}

function requireWholeMinute(value: Date, label: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${label} timestamp is invalid.`);
  }
  if (value.getUTCSeconds() !== 0 || value.getUTCMilliseconds() !== 0) {
    throw new Error(`${label} timestamp must be aligned to a whole minute.`);
  }
}

export function workedMinutes(start: Date, end: Date): number {
  requireWholeMinute(start, "Start");
  requireWholeMinute(end, "End");

  const elapsedMs = end.getTime() - start.getTime();
  if (elapsedMs < 0) {
    throw new Error("End timestamp cannot be before the start timestamp.");
  }

  const minutes = elapsedMs / 60_000;
  if (!Number.isInteger(minutes)) {
    throw new Error("Worked time must resolve to a whole minute.");
  }
  return minutes;
}

export function splitSessionByMaltaDate(
  clockIn: Date,
  clockOut: Date,
): MaltaSessionSlice[] {
  const totalMinutes = workedMinutes(clockIn, clockOut);
  if (totalMinutes === 0) return [];

  const slices: MaltaSessionSlice[] = [];
  let cursor = new Date(clockIn.getTime());
  const sessionEndMs = clockOut.getTime();

  while (cursor.getTime() < sessionEndMs) {
    const calendarDate = todayMaltaDate(cursor);
    const dayEnd = new Date(maltaDayUtcRange(calendarDate).end);
    const sliceEnd = new Date(Math.min(sessionEndMs, dayEnd.getTime()));

    if (sliceEnd.getTime() <= cursor.getTime()) {
      throw new Error("Could not advance the Malta attendance day boundary.");
    }

    slices.push({
      calendarDate,
      startsAt: new Date(cursor.getTime()),
      endsAt: new Date(sliceEnd.getTime()),
      workedMinutes: workedMinutes(cursor, sliceEnd),
    });

    cursor = sliceEnd;
  }

  return slices;
}

export function calculatePayCents(
  workedMinutes: number,
  hourlyRateCents: number,
  multiplierBps = 10000
): number {
  if (!Number.isInteger(workedMinutes) || workedMinutes < 0) {
    throw new Error("Worked minutes must be a non-negative integer.");
  }
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0) {
    throw new Error("Hourly rate must be a non-negative integer number of cents.");
  }
  if (!Number.isInteger(multiplierBps) || multiplierBps <= 0) {
    throw new Error("Holiday multiplier must be a positive integer basis-point value.");
  }

  return Math.round(
    (workedMinutes * hourlyRateCents * multiplierBps) / (60 * 10000)
  );
}
