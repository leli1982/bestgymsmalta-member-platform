import ExcelJS from "exceljs";
import {
  MEMBER_EXCHANGE_HEADERS,
  emptyMemberExchangeValues,
  memberExchangeModeFromHeaders,
  type MemberExchangeHeader,
  type MemberExchangeValues,
  type ParsedMemberExchangeFile,
  type ParsedMemberExchangeRow,
} from "./memberExchangeCore.ts";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000);
    const date = new Date(milliseconds);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return isoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  return "";
}

function nonFormulaCellText(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("error" in value) return String(value.error ?? "");
  }
  return String(value);
}

function cellValue(
  cell: ExcelJS.Cell,
  column: MemberExchangeHeader,
  expiryColumn: boolean
) {
  const raw = cell.value;
  if (raw && typeof raw === "object" && "formula" in raw) {
    return {
      value: "",
      issue: {
        kind: "formula_cell" as const,
        column,
        formula: String(raw.formula || ""),
        cachedResult: raw.result == null ? "" : String(raw.result),
        message: `Formula found in ${column}; replace it with literal text before import.`,
      },
    };
  }

  const plain = nonFormulaCellText(raw);
  if (expiryColumn) {
    if (plain === "") return { value: "", issue: null };
    const normalized = normalizeDateValue(plain);
    if (!normalized) {
      return {
        value: "",
        issue: {
          kind: "invalid_date" as const,
          column,
          message: `Invalid date found in ${column}; use a real Excel date, dd/mm/yyyy, or yyyy-mm-dd.`,
        },
      };
    }
    return { value: normalized, issue: null };
  }

  if (plain instanceof Date) {
    return { value: plain.toISOString(), issue: null };
  }
  return { value: String(plain ?? ""), issue: null };
}

function parseExportDate(value: string) {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export async function parseMemberExchangeXlsx(
  buffer: Buffer
): Promise<ParsedMemberExchangeFile> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS 4's Buffer declaration predates Node's generic Buffer type.
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Membership XLSX does not contain a worksheet.");

  const headerCells = sheet.getRow(1);
  const candidateLengths = [MEMBER_EXCHANGE_HEADERS.length, MEMBER_EXCHANGE_HEADERS.length - 1];
  let headers: string[] = [];
  let mode = null as ReturnType<typeof memberExchangeModeFromHeaders>;

  for (const length of candidateLengths) {
    const candidate = Array.from({ length }, (_, index) =>
      String(nonFormulaCellText(headerCells.getCell(index + 1).value) ?? "").trim()
    );
    const candidateMode = memberExchangeModeFromHeaders(candidate);
    if (candidateMode) {
      headers = candidate;
      mode = candidateMode;
      break;
    }
  }

  if (!mode) {
    throw new Error(
      "Membership XLSX header does not match the approved 15-column legacy or 16-column exchange format."
    );
  }

  const rows: ParsedMemberExchangeRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const values = emptyMemberExchangeValues();
    const issues: ParsedMemberExchangeRow["issues"] = [];
    let hasValue = false;

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index] as MemberExchangeHeader;
      const parsed = cellValue(
        excelRow.getCell(index + 1),
        header,
        header === "ExpiryDate1"
      );
      values[header] = parsed.value;
      if (parsed.value !== "") hasValue = true;
      if (parsed.issue) issues.push(parsed.issue);
    }

    if (!hasValue && issues.length === 0) continue;
    rows.push({ rowNumber, values, issues });
  }

  return { mode, headers, rows };
}

export async function buildMemberExchangeXlsx(
  rows: readonly ParsedMemberExchangeRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AllCustomers");
  sheet.addRow([...MEMBER_EXCHANGE_HEADERS]);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const output = MEMBER_EXCHANGE_HEADERS.map((header) => {
      const value = row.values[header] ?? "";
      if (header !== "ExpiryDate1" || !value) return value;
      return parseExportDate(value) ?? value;
    });
    const excelRow = sheet.addRow(output);
    excelRow.getCell(1).numFmt = "@";
    const expiryIndex = MEMBER_EXCHANGE_HEADERS.indexOf("ExpiryDate1") + 1;
    if (excelRow.getCell(expiryIndex).value instanceof Date) {
      excelRow.getCell(expiryIndex).numFmt = "dd/mm/yyyy";
    }
  }

  sheet.getColumn(1).numFmt = "@";
  sheet.columns.forEach((column, index) => {
    if (index === 0) column.width = 18;
    else if (index === 2 || index === 3) column.width = 24;
    else column.width = 16;
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function exchangeValuesRow(values: MemberExchangeValues, rowNumber = 2) {
  return { rowNumber, values, issues: [] } satisfies ParsedMemberExchangeRow;
}
