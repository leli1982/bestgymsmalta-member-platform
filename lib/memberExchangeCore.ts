export const LEGACY_MEMBER_HEADERS = [
  "Gym",
  "pkCustomer",
  "CustomerName",
  "CompanyName",
  "Address1",
  "Address2",
  "Town",
  "PostCode",
  "Gender",
  "TelephoneNo1",
  "TelephoneNo2",
  "Mobile",
  "Email",
  "ExpiryDate1",
  "ValidYN",
] as const;

export const MEMBER_EXCHANGE_HEADERS = [
  "CardBarcode",
  ...LEGACY_MEMBER_HEADERS,
] as const;

export type MemberExchangeMode = "legacy_15" | "exchange_16";
export type MemberExchangeHeader = (typeof MEMBER_EXCHANGE_HEADERS)[number];

export type MemberExchangeValues = Record<MemberExchangeHeader, string>;

export type MemberExchangeIssue = {
  kind: "formula_cell" | "invalid_date" | "invalid_row";
  column: string;
  message?: string;
  formula?: string;
  cachedResult?: string;
};

export type ParsedMemberExchangeRow = {
  rowNumber: number;
  values: MemberExchangeValues;
  issues: MemberExchangeIssue[];
};

export type ParsedMemberExchangeFile = {
  mode: MemberExchangeMode;
  headers: readonly string[];
  rows: ParsedMemberExchangeRow[];
};

export function normalizeLegacyValidity(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "valid") return "Valid";
  if (text === "not valid") return "Not Valid";
  return "";
}

export function statusFromLegacy(
  validYN: unknown,
  expiryDate?: string | null,
  today = new Date().toISOString().slice(0, 10)
) {
  if (normalizeLegacyValidity(validYN) !== "Valid") return "inactive";

  const expiry = String(expiryDate ?? "").trim();
  if (expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry) && expiry < today) {
    return "inactive";
  }

  return "active";
}

export function memberExchangeModeFromHeaders(
  headers: readonly string[]
): MemberExchangeMode | null {
  if (
    headers.length === MEMBER_EXCHANGE_HEADERS.length &&
    MEMBER_EXCHANGE_HEADERS.every((header, index) => headers[index] === header)
  ) {
    return "exchange_16";
  }

  if (
    headers.length === LEGACY_MEMBER_HEADERS.length &&
    LEGACY_MEMBER_HEADERS.every((header, index) => headers[index] === header)
  ) {
    return "legacy_15";
  }

  return null;
}

export function emptyMemberExchangeValues(): MemberExchangeValues {
  return Object.fromEntries(
    MEMBER_EXCHANGE_HEADERS.map((header) => [header, ""])
  ) as MemberExchangeValues;
}
