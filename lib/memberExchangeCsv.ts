import {
  MEMBER_EXCHANGE_HEADERS,
  emptyMemberExchangeValues,
  memberExchangeModeFromHeaders,
  type MemberExchangeValues,
  type ParsedMemberExchangeFile,
  type ParsedMemberExchangeRow,
} from "./memberExchangeCore";

type CsvRecord = {
  fields: string[];
  startLine: number;
};

function parseCsvRecords(text: string): CsvRecord[] {
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordStartLine = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
      continue;
    }

    if (char === ",") {
      fields.push(field);
      field = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      fields.push(field);
      field = "";
      records.push({ fields, startLine: recordStartLine });
      fields = [];

      if (char === "\r" && input[index + 1] === "\n") index += 1;
      line += 1;
      recordStartLine = line;
      continue;
    }

    field += char;
  }

  if (quoted) {
    throw new Error(`CSV contains an unterminated quoted field starting near line ${recordStartLine}.`);
  }

  if (field.length > 0 || fields.length > 0) {
    fields.push(field);
    records.push({ fields, startLine: recordStartLine });
  }

  while (
    records.length > 0 &&
    records[records.length - 1].fields.every((value) => value === "")
  ) {
    records.pop();
  }

  return records;
}

function valuesFromFields(headers: readonly string[], fields: string[]) {
  const values = emptyMemberExchangeValues();

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index] as keyof MemberExchangeValues;
    values[header] = fields[index] ?? "";
  }

  return values;
}

export function parseMemberExchangeCsv(text: string): ParsedMemberExchangeFile {
  const records = parseCsvRecords(text);
  if (records.length === 0) throw new Error("Membership CSV is empty.");

  const headers = records[0].fields.map((value) => value.trim());
  const mode = memberExchangeModeFromHeaders(headers);
  if (!mode) {
    throw new Error(
      "Membership CSV header does not match the approved 15-column legacy or 16-column exchange format."
    );
  }

  const rows: ParsedMemberExchangeRow[] = [];
  for (const record of records.slice(1)) {
    if (record.fields.every((value) => value === "")) continue;

    if (record.fields.length !== headers.length) {
      throw new Error(
        `CSV row ${record.startLine} has ${record.fields.length} columns; expected ${headers.length}.`
      );
    }

    rows.push({
      rowNumber: record.startLine,
      values: valuesFromFields(headers, record.fields),
      issues: [],
    });
  }

  return { mode, headers, rows };
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeMemberExchangeCsv(
  rows: readonly ParsedMemberExchangeRow[]
) {
  const lines = [MEMBER_EXCHANGE_HEADERS.map(escapeCsv).join(",")];

  for (const row of rows) {
    lines.push(
      MEMBER_EXCHANGE_HEADERS.map((header) =>
        escapeCsv(row.values[header] ?? "")
      ).join(",")
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}
