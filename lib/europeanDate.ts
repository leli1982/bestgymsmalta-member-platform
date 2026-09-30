const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EUROPEAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function validYmd(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function formatEuropeanDate(
  value: string | Date | null | undefined,
  fallback = "—"
): string {
  if (!value) return fallback;

  if (typeof value === "string") {
    const match = value.slice(0, 10).match(ISO_DATE);
    if (match && value.length <= 10) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : fallback;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatEuropeanDateTime(
  value: string | Date | null | undefined,
  fallback = "—",
  includeSeconds = false
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : fallback;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" as const } : {}),
    hourCycle: "h23",
  }).format(date).replace(",", "");
}

export function parseEuropeanDate(value: string): string | null {
  const match = value.trim().match(EUROPEAN_DATE);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (!validYmd(year, month, day)) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

export function europeanDateFromIso(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.slice(0, 10).match(ISO_DATE);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
