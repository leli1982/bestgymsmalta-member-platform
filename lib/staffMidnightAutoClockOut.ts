import { maltaDayUtcRange, todayMaltaDate } from "./maltaDate.ts";

export const MIDNIGHT_AUTO_CLOCK_OUT_ATTENTION_CODE = "midnight_auto_clock_out" as const;
export const MIDNIGHT_AUTO_CLOCK_OUT_LABEL = "System – Midnight Auto Clock-Out" as const;

export function midnightAutoClockOutCutoff(clockInAt: string | Date): string {
  const clockIn = clockInAt instanceof Date ? new Date(clockInAt.getTime()) : new Date(clockInAt);
  if (Number.isNaN(clockIn.getTime())) throw new Error("A valid clock-in timestamp is required.");

  const workDate = todayMaltaDate(clockIn);
  return maltaDayUtcRange(workDate).end;
}

export function isMidnightAutoClockOutDue(
  clockInAt: string | Date,
  now = new Date(),
): boolean {
  if (Number.isNaN(now.getTime())) throw new Error("A valid current timestamp is required.");
  return now.getTime() >= new Date(midnightAutoClockOutCutoff(clockInAt)).getTime();
}

export function midnightAutoClockOutEventKey(sessionId: string, cutoff: string): string {
  const normalizedSessionId = String(sessionId || "").trim();
  const cutoffDate = new Date(cutoff);
  if (!normalizedSessionId) throw new Error("A session ID is required.");
  if (Number.isNaN(cutoffDate.getTime())) throw new Error("A valid cutoff timestamp is required.");
  return `staff-midnight-auto-clock-out:${normalizedSessionId}:${cutoffDate.toISOString()}`;
}
