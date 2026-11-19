/**
 * Convert a wall-clock date and time entered by Super Admin into a UTC instant
 * using Europe/Malta rather than the browser's machine timezone.
 *
 * Malta is UTC+1 in winter and UTC+2 in summer for supported years.
 * Refuse nonexistent or repeated clock-change times rather than silently
 * recording a different payroll instant.
 */
const maltaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function maltaAttendanceWallTimeToIso(date: string, time: string): string {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dayMatch || !timeMatch) {
    throw new Error("Enter a valid Malta attendance date and time.");
  }

  const year = Number(dayMatch[1]);
  const month = Number(dayMatch[2]);
  const day = Number(dayMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  // The time-zone offsets below are valid for Malta's modern attendance dates.
  if (year < 2000 || year > 2100) {
    throw new Error("Malta attendance date must be between 2000 and 2100.");
  }
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year ||
      calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day) {
    throw new Error("Enter a valid Malta attendance calendar date.");
  }

  const expected = [dayMatch[1], dayMatch[2], dayMatch[3], timeMatch[1], timeMatch[2]].join("-");
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [1, 2].map(offsetHours => wallUtc - offsetHours * 60 * 60 * 1000)
    .filter(instant => {
      const parts = maltaFormatter.formatToParts(new Date(instant));
      const get = (name: string) => parts.find(part => part.type === name)?.value || "";
      const actual = [get("year"), get("month"), get("day"), get("hour"), get("minute")].join("-");
      return actual === expected;
    });

  if (candidates.length === 0) {
    throw new Error("This Malta time does not exist because the clocks move forward. Select a valid time.");
  }
  if (candidates.length > 1) {
    throw new Error("This Malta time occurs twice when the clocks move back. An explicit time-offset correction is required.");
  }

  return new Date(candidates[0]).toISOString();
}
