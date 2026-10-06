export type StaffEmploymentType = "full_time" | "part_time";

export type EffectiveRow = {
  effectiveFrom: string;
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
