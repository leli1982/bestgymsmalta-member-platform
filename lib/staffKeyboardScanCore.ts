/**
 * Keyboard-wedge scanners behave like very fast keyboards. There is no browser API
 * that can conclusively distinguish them from rapid human typing. This detector
 * only accepts long, compact and fast strings terminated by Enter. The manual
 * Scan card dialog is the reliable fallback for unusual devices/field types.
 */
export const MIN_SCAN_LENGTH = 7;
export const MAX_SCAN_LENGTH = 128;
export const MAX_AVERAGE_INTERVAL_MS = 65;
export const MAX_CONTIGUOUS_GAP_MS = 160;
export const CAPTURE_AFTER_CHARS = 4;

export function looksLikeKeyboardBarcode(
  text: string,
  elapsedMs: number,
  lastGapMs: number,
): boolean {
  return (
    text.length >= MIN_SCAN_LENGTH &&
    text.length <= MAX_SCAN_LENGTH &&
    /^[a-z0-9_-]+$/i.test(text) &&
    elapsedMs >= 0 &&
    elapsedMs / Math.max(1, text.length - 1) <= MAX_AVERAGE_INTERVAL_MS &&
    lastGapMs <= MAX_CONTIGUOUS_GAP_MS
  );
}

export function shouldHoldScannerCandidate(
  length: number,
  elapsedMs: number,
  lastGapMs: number,
): boolean {
  return (
    length >= CAPTURE_AFTER_CHARS &&
    elapsedMs / Math.max(1, length - 1) <= MAX_AVERAGE_INTERVAL_MS &&
    lastGapMs <= MAX_CONTIGUOUS_GAP_MS
  );
}
