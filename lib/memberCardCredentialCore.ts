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
  return current && current === scanned ? "keep" : "replace";
}
