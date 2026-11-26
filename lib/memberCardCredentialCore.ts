export type CardCredentialStatus = "reserved" | "active" | "retired";

export function normalizeBarcodePayload(raw: string): string {
  return String(raw ?? "").trim();
}

export function decideRenewalCardAction(
  currentBarcode: string | null,
  scannedBarcode: string
): "keep" | "replace" {
  const scanned = normalizeBarcodePayload(scannedBarcode);
  if (!scanned) throw new Error("Card barcode is required.");

  const current = currentBarcode === null ? null : normalizeBarcodePayload(currentBarcode);
  return current && current.toUpperCase() === scanned.toUpperCase() ? "keep" : "replace";
}

// Reject an obvious keyboard-wedge concatenation of multiple X-series cards.
// Do not restrict the format of other historical or future card series.
export function isConcatenatedPhysicalBarcode(value: string): boolean {
  return /^(?:X[0-9]+){2,}$/i.test(normalizeBarcodePayload(value));
}
