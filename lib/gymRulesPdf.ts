type GymRulesDeclaration = {
  versionNo?: number | string | null;
  body?: string | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 50;
const TOP = 792;
const LINE_HEIGHT = 14;
const MAX_BODY_LINES_PER_PAGE = 46;
const MAX_LINE_CHARS = 88;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function gymRulesPdfFilename(declaration: GymRulesDeclaration) {
  const version = clean(declaration.versionNo).replace(/[^A-Za-z0-9._-]+/g, "-") || "accepted";
  return `BestGymsMalta-Gym-Rules-v${version}.pdf`;
}

const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
  "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

function toWinAnsi(value: string) {
  let result = "";
  for (const char of value) {
    const cp = char.codePointAt(0) ?? 0;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) {
      result += String.fromCharCode(cp);
      continue;
    }
    const mapped = CP1252[char];
    if (mapped !== undefined) {
      result += String.fromCharCode(mapped);
      continue;
    }
    if (char === "\t") {
      result += "    ";
      continue;
    }
    throw new Error(`Gym Rules PDF cannot encode character U+${cp.toString(16).toUpperCase().padStart(4, "0")}.`);
  }
  return result;
}

function escapePdfLiteral(value: string) {
  return toWinAnsi(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line: string) {
  if (!line) return [""];
  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + " " + word).length <= MAX_LINE_CHARS) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function wrapBody(body: string) {
  return body.replace(/\r\n?/g, "\n").split("\n").flatMap(wrapLine);
}

function contentStream(version: string, lines: string[], pageNo: number, pageCount: number) {
  const heading = pageNo === 1
    ? ["BestGymsMalta", "Gym Rules", version ? `Version ${version}` : "Accepted version", ""]
    : ["BestGymsMalta — Gym Rules", version ? `Version ${version}` : "Accepted version", ""];
  const footer = `Page ${pageNo} of ${pageCount}`;
  const bodyCommands = [...heading, ...lines].map((line, index) => {
    const size = index === 0 ? 16 : index === 1 && pageNo === 1 ? 14 : 10.5;
    return `/F1 ${size} Tf (${escapePdfLiteral(line)}) Tj T*`;
  });
  return [
    "BT",
    `1 0 0 1 ${LEFT} ${TOP} Tm`,
    `${LINE_HEIGHT} TL`,
    ...bodyCommands,
    "ET",
    "BT",
    "/F1 9 Tf",
    `1 0 0 1 ${LEFT} 34 Tm`,
    `(${escapePdfLiteral(footer)}) Tj`,
    "ET",
  ].join("\n");
}

export function buildGymRulesPdf(declaration: GymRulesDeclaration) {
  const body = clean(declaration.body);
  if (!body) throw new Error("Gym Rules declaration body is missing.");
  const version = clean(declaration.versionNo);
  const wrapped = wrapBody(body);
  const chunks: string[][] = [];
  for (let i = 0; i < wrapped.length; i += MAX_BODY_LINES_PER_PAGE) {
    chunks.push(wrapped.slice(i, i + MAX_BODY_LINES_PER_PAGE));
  }
  if (!chunks.length) chunks.push([]);

  const pageIds = chunks.map((_, index) => 4 + index * 2);
  const contentIds = chunks.map((_, index) => 5 + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  chunks.forEach((lines, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const stream = contentStream(version, lines, index + 1, chunks.length);
    const streamLength = Buffer.byteLength(stream, "latin1");
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
  });

  const maxId = Math.max(...objects.keys());
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  pdf += `% BGM-Gym-Rules-Version: ${version || "accepted"}\n`;
  pdf += `% BGM-Gym-Rules-UTF8-Base64: ${Buffer.from(body, "utf8").toString("base64")}\n`;
  const offsets = new Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
