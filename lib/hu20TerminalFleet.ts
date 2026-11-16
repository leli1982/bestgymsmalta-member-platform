// TEST-only fleet status is an observation of authenticated server traffic,
// not an assertion that a kiosk process is alive or that an HU20 is connected.
export type Hu20TerminalContactStatus = "never" | "recent" | "stale" | "invalid";
export const HU20_RECENT_CONTACT_MS = 15 * 60 * 1000;

export function hu20TerminalContactStatus(
  timestamp: string | null | undefined,
  asOfMillis: number,
): Hu20TerminalContactStatus {
  if (!timestamp) return "never";
  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis) || !Number.isFinite(asOfMillis) ||
      millis > asOfMillis + 60_000) return "invalid";
  return (asOfMillis - millis <= HU20_RECENT_CONTACT_MS) ? "recent" : "stale";
}
