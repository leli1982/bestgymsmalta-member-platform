import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MEMBER_EXCHANGE_HEADERS,
  normalizeLegacyValidity,
  statusFromLegacy,
  type MemberExchangeMode,
  type ParsedMemberExchangeFile,
  type ParsedMemberExchangeRow,
} from "@/lib/memberExchangeCore";
import { parseMemberExchangeCsv } from "@/lib/memberExchangeCsv";
import { parseMemberExchangeXlsx } from "@/lib/memberExchangeWorkbook";
import { normalizeBarcodePayload } from "@/lib/memberCardCredentialCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import {
  oldSystemFullName,
  sourceValidityMismatch,
  statusFromExpiryDate,
} from "@/lib/legacyMemberImportCore";
import {
  classifyExistingBgmMemberImport,
  type ExistingMemberForMatch,
  type IncomingMemberForMatch,
  type MemberImportAction,
} from "@/lib/memberImportMatchCore";

const PAGE_SIZE = 1000;
const STAGING_CHUNK_SIZE = 500;

export type MemberImportIssuePreview = {
  rowNumber: number;
  action: "conflict" | "invalid" | "warning" | "missing_source" | "rejected";
  blocking: boolean;
  memberNumber: string;
  cardBarcode: string;
  customerName: string;
  gym: string;
  pkCustomer: string;
  issue: string;
};

export type MemberImportPreviewResult = {
  batchId: string;
  filename: string;
  fileFormat: "xlsx" | "csv";
  importMode: MemberExchangeMode;
  totalRows: number;
  convertedRows: number;
  countVerified: boolean;
  newRows: number;
  updateRows: number;
  unchangedRows: number;
  duplicateRows: number;
  redundantRows: number;
  missingSourceRows: number;
  warningRows: number;
  conflictRows: number;
  invalidRows: number;
  rejectedRows: number;
  cardRows: number;
  blankCardRows: number;
  issues: MemberImportIssuePreview[];
};

type ExistingMemberDbRow = {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
  legacy_gym: string | null;
  legacy_pk_customer: string | null;
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  country: string | null;
  gender: string | null;
  telephone_no_1: string | null;
  telephone_no_2: string | null;
  mobile: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  membership_expiry: string | null;
  status: string | null;
  cancellation_effective_date: string | null;
  real_import_batch_id: string | null;
  real_import_row_number: number | null;
};

type ExistingCardCredentialDbRow = {
  barcode_value: string;
  member_id: string | null;
  status: "reserved" | "active" | "retired";
};

type LegacyClaimDbRow = {
  member_id: string;
  scan3: string;
  assignment_status: "active" | "removed";
};

type AppliedLegacyLineage = {
  byFingerprint: Map<string, string[]>;
  byFingerprintRow: Map<string, string[]>;
};

type StagedImportRow = {
  batch_id: string;
  membership_number: string | null;
  row_number: number;
  card_barcode: string | null;
  legacy_scan3: string | null;
  gym: string | null;
  pk_customer: string | null;
  customer_name: string | null;
  company_name: string | null;
  surname: string | null;
  address1: string | null;
  address2: string | null;
  town: string | null;
  postcode: string | null;
  country: string | null;
  gender: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  telephone_no_1: string | null;
  telephone_no_2: string | null;
  mobile: string | null;
  email: string | null;
  expiry_date: string | null;
  valid_yn: string | null;
  source_valid_yn: string | null;
  source_data: Record<string, string> | null;
  source_fingerprint: string;
  action: MemberImportAction;
  matched_member_id: string | null;
  issue: string | null;
};

type ReviewItem = {
  batch_id: string;
  review_type: "conflict" | "invalid" | "warning" | "missing_source" | "rejected";
  blocking: boolean;
  source_row_number: number | null;
  member_id: string | null;
  member_number: string | null;
  customer_name: string | null;
  gym: string | null;
  pk_customer: string | null;
  legacy_scan3: string | null;
  issue: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return clean(value).replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

function legacyScanKey(value: unknown) {
  return normalizeBarcodePayload(String(value ?? "")).toLocaleUpperCase("en");
}

function historicalLegacyIdentityKey(
  rowNumber: number,
  name: unknown,
  pkCustomer: unknown,
  scan3: unknown
) {
  const n = normalized(name);
  const pk = normalized(pkCustomer);
  const scan = legacyScanKey(scan3);
  if (!rowNumber || !n || !pk || !scan) return "";
  return [rowNumber, n, pk, scan].join("\u0000");
}

function source(row: ParsedMemberExchangeRow, key: string) {
  return clean(row.sourceValues?.[key]);
}

function legacyKey(gym: unknown, pkCustomer: unknown) {
  const gymKey = normalized(gym);
  const pkKey = normalized(pkCustomer);
  if (!gymKey || !pkKey) return "";
  return `${gymKey}\u0000${pkKey}`;
}

function nameEmailKey(name: unknown, email: unknown) {
  const n = normalized(name);
  const e = clean(email).toLocaleLowerCase("en");
  if (!n || !e) return "";
  return `${n}|${e}`;
}

function nameDobKey(name: unknown, dob: unknown) {
  const n = normalized(name);
  const d = clean(dob);
  if (!n || !d) return "";
  return `${n}|${d}`;
}

function fingerprint(row: ParsedMemberExchangeRow) {
  const payload = row.sourceValues
    ? Object.fromEntries(Object.keys(row.sourceValues).sort().map((key) => [key, row.sourceValues?.[key] ?? ""]))
    : MEMBER_EXCHANGE_HEADERS.map((header) => row.values[header] ?? "");
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function dbMemberToMatch(
  row: ExistingMemberDbRow,
  activeCardByMemberId: Map<string, string>
): ExistingMemberForMatch {
  return {
    id: row.id,
    memberNumber: row.member_number,
    cardBarcode: activeCardByMemberId.get(row.id) || null,
    legacyGym: row.legacy_gym,
    legacyPkCustomer: row.legacy_pk_customer,
    fullName: row.full_name,
    companyName: row.company_name,
    address1: row.address_line_1,
    address2: row.address_line_2,
    town: row.town,
    postcode: row.postcode,
    gender: row.gender,
    telephoneNo1: row.telephone_no_1,
    telephoneNo2: row.telephone_no_2,
    mobile: row.mobile,
    email: row.email,
    membershipExpiry: row.membership_expiry,
    status: row.status,
  };
}

function incomingFromRow(
  row: ParsedMemberExchangeRow,
  mode: MemberExchangeMode
): IncomingMemberForMatch {
  const values = row.values;
  return {
    cardBarcode: normalizeBarcodePayload(values.CardBarcode),
    gym: values.Gym,
    pkCustomer: values.pkCustomer,
    customerName: values.CustomerName,
    companyName: values.CompanyName,
    address1: values.Address1,
    address2: values.Address2,
    town: values.Town,
    postcode: values.PostCode,
    gender: values.Gender,
    telephoneNo1: values.TelephoneNo1,
    telephoneNo2: values.TelephoneNo2,
    mobile: values.Mobile,
    email: values.Email,
    expiryDate: values.ExpiryDate1,
    status:
      mode === "legacy_22"
        ? statusFromExpiryDate(values.ExpiryDate1, todayMaltaDate()) || "inactive"
        : statusFromLegacy(values.ValidYN, values.ExpiryDate1),
  };
}

async function parseUploadedMembershipFile(file: File) {
  const filename = clean(file.name);
  const lower = filename.toLocaleLowerCase("en");

  if (lower.endsWith(".xlsx")) {
    const parsed = await parseMemberExchangeXlsx(Buffer.from(await file.arrayBuffer()));
    return { parsed, fileFormat: "xlsx" as const };
  }

  if (lower.endsWith(".csv")) {
    const parsed = parseMemberExchangeCsv(await file.text());
    return { parsed, fileFormat: "csv" as const };
  }

  throw new Error("Use an .xlsx or .csv membership file.");
}

async function loadExistingMembers(supabase: SupabaseClient) {
  const rows: ExistingMemberDbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_members")
      .select(
        "id, member_number, full_name, email, legacy_gym, legacy_pk_customer, company_name, address_line_1, address_line_2, town, postcode, country, gender, telephone_no_1, telephone_no_2, mobile, id_number, date_of_birth, membership_expiry, status, cancellation_effective_date, real_import_batch_id, real_import_row_number"
      )
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as ExistingMemberDbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadExistingCardCredentials(supabase: SupabaseClient) {
  const rows: ExistingCardCredentialDbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_member_card_credentials")
      .select("barcode_value, member_id, status")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as ExistingCardCredentialDbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadLegacyClaims(supabase: SupabaseClient) {
  const rows: LegacyClaimDbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_legacy_card_claims")
      .select("member_id, scan3, assignment_status")
      .order("member_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as LegacyClaimDbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadAppliedLegacyLineage(
  supabase: SupabaseClient
): Promise<AppliedLegacyLineage> {
  const batches = await supabase
    .from("bgm_member_import_batches")
    .select("id")
    .eq("status", "applied")
    .eq("import_mode", "legacy_22")
    .order("applied_at", { ascending: false })
    .limit(1);

  if (batches.error) throw batches.error;
  const batchIds = (batches.data || []).map((row) => String(row.id));
  const byFingerprintSets = new Map<string, Set<string>>();
  const byFingerprintRowSets = new Map<string, Set<string>>();

  if (batchIds.length === 0) {
    return { byFingerprint: new Map(), byFingerprintRow: new Map() };
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_member_import_rows")
      .select("batch_id, row_number, source_fingerprint, matched_member_id, action")
      .eq("batch_id", batchIds[0])
      .order("row_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    const page = result.data || [];

    for (const row of page) {
      if (!["new", "update", "unchanged"].includes(clean(row.action))) continue;
      const fp = clean(row.source_fingerprint);
      const memberId = clean(row.matched_member_id);
      if (!fp || !memberId) continue;

      const fpSet = byFingerprintSets.get(fp) || new Set<string>();
      fpSet.add(memberId);
      byFingerprintSets.set(fp, fpSet);

      const fpRowKey = `${fp}\u0000${Number(row.row_number)}`;
      const fpRowSet = byFingerprintRowSets.get(fpRowKey) || new Set<string>();
      fpRowSet.add(memberId);
      byFingerprintRowSets.set(fpRowKey, fpRowSet);
    }

    if (page.length < PAGE_SIZE) break;
  }

  return {
    byFingerprint: new Map(
      Array.from(byFingerprintSets.entries()).map(([key, value]) => [
        key,
        Array.from(value),
      ])
    ),
    byFingerprintRow: new Map(
      Array.from(byFingerprintRowSets.entries()).map(([key, value]) => [
        key,
        Array.from(value),
      ])
    ),
  };
}

function createMemberIndexes(
  existing: ExistingMemberDbRow[],
  credentials: ExistingCardCredentialDbRow[],
  claims: LegacyClaimDbRow[]
) {
  const byMemberNumber = new Map<string, ExistingMemberForMatch>();
  const byCardBarcode = new Map<string, ExistingMemberForMatch[]>();
  const byLegacy = new Map<string, ExistingMemberForMatch[]>();
  const byLegacyPk = new Map<string, ExistingMemberForMatch[]>();
  const byNameEmail = new Map<string, ExistingMemberForMatch[]>();
  const byNameDob = new Map<string, ExistingMemberForMatch[]>();
  const byIdNumber = new Map<string, ExistingMemberForMatch[]>();
  const byLegacyScan = new Map<string, ExistingMemberForMatch[]>();
  const byHistoricalRowIdentity = new Map<string, ExistingMemberForMatch[]>();
  const rawById = new Map(existing.map((row) => [row.id, row]));
  const occupiedBarcodes = new Set<string>();
  const activeCardByMemberId = new Map<string, string>();
  const scan3ByMemberId = new Map<string, string>();

  for (const credential of credentials) {
    const barcode = normalizeBarcodePayload(credential.barcode_value);
    if (!barcode) continue;
    occupiedBarcodes.add(barcode);
    if (credential.status === "active" && credential.member_id) {
      activeCardByMemberId.set(credential.member_id, barcode);
    }
  }

  for (const claim of claims) {
    if (claim.assignment_status !== "active") continue;
    const scan3 = legacyScanKey(claim.scan3);
    if (scan3) scan3ByMemberId.set(claim.member_id, scan3);
  }

  for (const raw of existing) {
    const member = dbMemberToMatch(raw, activeCardByMemberId);
    byMemberNumber.set(raw.member_number.trim().toUpperCase(), member);

    const emailKey = nameEmailKey(member.fullName, member.email);
    if (emailKey) byNameEmail.set(emailKey, [...(byNameEmail.get(emailKey) || []), member]);

    const dobKey = nameDobKey(member.fullName, raw.date_of_birth);
    if (dobKey) byNameDob.set(dobKey, [...(byNameDob.get(dobKey) || []), member]);

    const idNumber = normalized(raw.id_number);
    if (idNumber) byIdNumber.set(idNumber, [...(byIdNumber.get(idNumber) || []), member]);

    const cardBarcode = clean(member.cardBarcode);
    if (cardBarcode) byCardBarcode.set(cardBarcode, [...(byCardBarcode.get(cardBarcode) || []), member]);

    const pk = normalized(member.legacyPkCustomer);
    if (pk) byLegacyPk.set(pk, [...(byLegacyPk.get(pk) || []), member]);

    const key = legacyKey(member.legacyGym, member.legacyPkCustomer);
    if (key) byLegacy.set(key, [...(byLegacy.get(key) || []), member]);

    const scan3 = scan3ByMemberId.get(raw.id);
    if (scan3) byLegacyScan.set(scan3, [...(byLegacyScan.get(scan3) || []), member]);

    const historicalKey = historicalLegacyIdentityKey(
      raw.real_import_row_number || 0,
      raw.full_name,
      raw.legacy_pk_customer,
      scan3
    );
    if (raw.real_import_batch_id && historicalKey) {
      byHistoricalRowIdentity.set(historicalKey, [
        ...(byHistoricalRowIdentity.get(historicalKey) || []),
        member,
      ]);
    }
  }

  return {
    byMemberNumber,
    byCardBarcode,
    byLegacy,
    byLegacyPk,
    byNameEmail,
    byNameDob,
    byIdNumber,
    byLegacyScan,
    byHistoricalRowIdentity,
    rawById,
    scan3ByMemberId,
    occupiedBarcodes,
  };
}

const LEGACY_NONBLOCKING_FORMULA_COLUMNS = new Set([
  "TelephoneNo1",
  "TelephoneNo2",
  "Mobile",
  "Fax",
  "Web",
  "Contact",
  "ContactPhone",
]);

function blockingRowIssue(row: ParsedMemberExchangeRow, mode: MemberExchangeMode) {
  const blocking = row.issues.filter(
    (issue) =>
      !(
        mode === "legacy_22" &&
        issue.kind === "formula_cell" &&
        LEGACY_NONBLOCKING_FORMULA_COLUMNS.has(issue.column)
      )
  );
  if (!blocking.length) return "";
  return blocking.map((issue) => issue.message || `${issue.kind} in ${issue.column}`).join(" ");
}

function nonBlockingFormulaIssues(row: ParsedMemberExchangeRow, mode: MemberExchangeMode) {
  if (mode !== "legacy_22") return [];
  return row.issues.filter(
    (issue) =>
      issue.kind === "formula_cell" &&
      LEGACY_NONBLOCKING_FORMULA_COLUMNS.has(issue.column)
  );
}

function identityName(row: IncomingMemberForMatch | ExistingMemberForMatch) {
  const name = "id" in row ? row.fullName || row.companyName : row.customerName || row.companyName;
  return normalized(name);
}

function uniqueMembers(items: ExistingMemberForMatch[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function conservativeLegacyMatch(
  incoming: IncomingMemberForMatch,
  candidates: ExistingMemberForMatch[]
): { action: MemberImportAction; matchedMemberId: string | null; issue: string } {
  if (!identityName(incoming)) {
    return { action: "invalid", matchedMemberId: null, issue: "CustomerName and CompanyName are both blank." };
  }
  if (candidates.length === 0) return { action: "new", matchedMemberId: null, issue: "" };
  const name = identityName(incoming);
  const matching = uniqueMembers(candidates).filter((candidate) => {
    if (!name || identityName(candidate) !== name) return false;
    const a = clean(incoming.email).toLocaleLowerCase("en");
    const b = clean(candidate.email).toLocaleLowerCase("en");
    return !(a && b && a !== b);
  });
  if (matching.length === 1) return { action: "unchanged", matchedMemberId: matching[0].id, issue: "" };
  return {
    action: "conflict",
    matchedMemberId: null,
    issue: "Legacy gym/card reference is ambiguous or conflicts with an existing member. Review rather than guessing or creating a duplicate.",
  };
}

function priorAppliedLegacyMember(
  sourceFingerprint: string,
  row: ParsedMemberExchangeRow,
  candidates: ExistingMemberForMatch[],
  lineage: AppliedLegacyLineage,
  indexes: ReturnType<typeof createMemberIndexes>
) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const fingerprintMatches = lineage.byFingerprint.get(sourceFingerprint) || [];

  if (
    fingerprintMatches.length === 1 &&
    candidateIds.has(fingerprintMatches[0])
  ) {
    return fingerprintMatches[0];
  }

  const rowMatches =
    lineage.byFingerprintRow.get(`${sourceFingerprint}\u0000${row.rowNumber}`) || [];
  if (rowMatches.length === 1 && candidateIds.has(rowMatches[0])) {
    return rowMatches[0];
  }

  const historicalKey = historicalLegacyIdentityKey(
    row.rowNumber,
    oldSystemFullName(source(row, "CustomerName"), source(row, "Surname")),
    source(row, "pkCustomer"),
    source(row, "Scan3")
  );
  const historicalMatches = historicalKey
    ? indexes.byHistoricalRowIdentity.get(historicalKey) || []
    : [];
  if (
    historicalMatches.length === 1 &&
    candidateIds.has(historicalMatches[0].id)
  ) {
    return historicalMatches[0].id;
  }

  return null;
}

function legacy22Match(
  row: ParsedMemberExchangeRow,
  candidates: ExistingMemberForMatch[],
  indexes: ReturnType<typeof createMemberIndexes>
) {
  const unique = uniqueMembers(candidates);
  if (unique.length === 0) return { action: "new" as MemberImportAction, matchedMemberId: null, issue: "" };

  const wantedName = normalized(row.values.CustomerName);
  const wantedEmail = clean(row.values.Email).toLocaleLowerCase("en");
  const wantedPk = normalized(row.values.pkCustomer);
  const wantedGym = normalized(row.values.Gym);
  const wantedId = normalized(source(row, "IDCard"));
  const wantedDob = source(row, "DOB");
  const wantedScan = legacyScanKey(source(row, "Scan3"));

  const scored = unique
    .map((candidate) => {
      const raw = indexes.rawById.get(candidate.id);
      if (!raw) return { candidate, score: -999 };

      if (wantedId && normalized(raw.id_number) && wantedId !== normalized(raw.id_number)) {
        return { candidate, score: -999 };
      }
      if (wantedDob && clean(raw.date_of_birth) && wantedDob !== clean(raw.date_of_birth)) {
        return { candidate, score: -999 };
      }

      let score = 0;
      if (wantedName && wantedName === normalized(raw.full_name)) score += 4;
      if (wantedId && wantedId === normalized(raw.id_number)) score += 6;
      if (wantedDob && wantedDob === clean(raw.date_of_birth)) score += 4;
      if (wantedEmail && wantedEmail === clean(raw.email).toLocaleLowerCase("en")) score += 4;
      if (wantedPk && wantedPk === normalized(raw.legacy_pk_customer)) score += 3;
      if (wantedGym && wantedGym === normalized(raw.legacy_gym)) score += 1;
      if (wantedScan && wantedScan === indexes.scan3ByMemberId.get(raw.id)) score += 3;
      return { candidate, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < 4) {
    // legacy pkCustomer and Scan3 values were historically reused. A weak
    // reference-only hit is not enough to claim an existing BGM identity.
    return { action: "new" as MemberImportAction, matchedMemberId: null, issue: "" };
  }

  const best = scored.filter((entry) => entry.score === scored[0].score);
  if (best.length !== 1) {
    return {
      action: "conflict" as MemberImportAction,
      matchedMemberId: null,
      issue: "More than one existing BGM member is an equally strong match for this old-system row.",
    };
  }

  return { action: "update" as MemberImportAction, matchedMemberId: best[0].candidate.id, issue: "" };
}

function sameLegacy22Values(
  row: ParsedMemberExchangeRow,
  existing: ExistingMemberDbRow,
  existingScan3: string | undefined
) {
  const status = statusFromExpiryDate(row.values.ExpiryDate1, todayMaltaDate());
  const pairs: Array<[unknown, unknown]> = [
    [row.values.CustomerName, existing.full_name],
    [row.values.Gym, existing.legacy_gym],
    [row.values.pkCustomer, existing.legacy_pk_customer],
    [row.values.Address1, existing.address_line_1],
    [row.values.Address2, existing.address_line_2],
    [row.values.Town, existing.town],
    [row.values.PostCode, existing.postcode],
    [source(row, "Country"), existing.country],
    [row.values.Gender, existing.gender],
    [row.values.TelephoneNo1, existing.telephone_no_1],
    [row.values.TelephoneNo2, existing.telephone_no_2],
    [row.values.Mobile, existing.mobile],
    [row.values.Email, existing.email],
    [source(row, "IDCard"), existing.id_number],
    [source(row, "DOB"), existing.date_of_birth],
    [row.values.ExpiryDate1, existing.membership_expiry],
    [status, existing.status],
  ];

  const baseMatches = pairs.every(([left, right]) => {
    if (!clean(left)) return true;
    return normalized(left) === normalized(right);
  });

  const scan3 = legacyScanKey(source(row, "Scan3"));
  const scanMatches = !scan3 || !existingScan3 || scan3 === legacyScanKey(existingScan3);
  return baseMatches && scanMatches;
}

function sourceBaseDuplicateKey(row: ParsedMemberExchangeRow) {
  if (!row.sourceValues) return "";
  return [
    normalized(source(row, "CustomerName")),
    normalized(source(row, "Surname")),
    normalized(source(row, "pkCustomer")),
    legacyScanKey(source(row, "Scan3")),
    clean(source(row, "ExpiryDate")),
  ].join("\u0000");
}

function sourceDocument(value: unknown) {
  return clean(value).toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
}

function sourcePhone(row: ParsedMemberExchangeRow) {
  for (const key of ["TelephoneNo2", "Mobile", "TelephoneNo1", "ContactPhone"]) {
    const digits = clean(source(row, key)).replace(/\D/g, "");
    if (digits) return digits;
  }
  return "";
}

function sourceEvidence(row: ParsedMemberExchangeRow) {
  return {
    dob: clean(source(row, "DOB")),
    id: sourceDocument(source(row, "IDCard")),
    email: clean(source(row, "Email")).toLocaleLowerCase("en"),
    phone: sourcePhone(row),
  };
}

function sourceEvidenceCount(row: ParsedMemberExchangeRow) {
  return Object.values(sourceEvidence(row)).filter(Boolean).length;
}

function normalizedSourceSignature(row: ParsedMemberExchangeRow) {
  const sourceValues = row.sourceValues || {};
  return Object.keys(sourceValues)
    .sort()
    .map((key) => `${key}=${normalized(sourceValues[key])}`)
    .join("\u0001");
}

function sourceEvidenceRelation(
  row: ParsedMemberExchangeRow,
  candidate: ParsedMemberExchangeRow
) {
  const left = sourceEvidence(row);
  const right = sourceEvidence(candidate);

  if (left.dob && right.dob) {
    if (left.dob === right.dob) return "duplicate" as const;
    return "distinct" as const;
  }

  let matches = 0;
  let conflicts = 0;
  for (const key of ["id", "email", "phone"] as const) {
    if (!left[key] || !right[key]) continue;
    if (left[key] === right[key]) matches += 1;
    else conflicts += 1;
  }

  if (matches > 0 && conflicts === 0) return "duplicate" as const;
  if (conflicts > 0) return "distinct" as const;
  return "unknown" as const;
}

function preclassifyLegacy22Source(rows: ParsedMemberExchangeRow[]) {
  const duplicateRows = new Set<number>();
  const ambiguousRows = new Set<number>();
  const redundantRows = new Set<number>();
  const baseGroups = new Map<string, ParsedMemberExchangeRow[]>();

  for (const row of rows) {
    const key = sourceBaseDuplicateKey(row);
    if (!key) continue;
    baseGroups.set(key, [...(baseGroups.get(key) || []), row]);
  }

  for (const group of Array.from(baseGroups.values())) {
    if (group.length < 2) continue;

    const representatives: ParsedMemberExchangeRow[] = [];
    const ordered = [...group].sort(
      (a, b) =>
        sourceEvidenceCount(b) - sourceEvidenceCount(a) ||
        a.rowNumber - b.rowNumber
    );

    for (const row of ordered) {
      const normalizedSignature = normalizedSourceSignature(row);
      if (
        representatives.some(
          (candidate) => normalizedSourceSignature(candidate) === normalizedSignature
        )
      ) {
        duplicateRows.add(row.rowNumber);
        continue;
      }

      const duplicateCandidates = representatives.filter(
        (candidate) => sourceEvidenceRelation(row, candidate) === "duplicate"
      );
      if (duplicateCandidates.length === 1) {
        duplicateRows.add(row.rowNumber);
        continue;
      }
      if (duplicateCandidates.length > 1) {
        ambiguousRows.add(row.rowNumber);
        representatives.push(row);
        continue;
      }

      const evidenceCount = sourceEvidenceCount(row);
      if (evidenceCount === 0) {
        const richer = representatives.filter(
          (candidate) => sourceEvidenceCount(candidate) > 0
        );
        if (richer.length === 1) {
          duplicateRows.add(row.rowNumber);
          continue;
        }
        if (richer.length > 1 || representatives.length > 0) {
          ambiguousRows.add(row.rowNumber);
        }
      }

      representatives.push(row);
    }
  }

  const today = todayMaltaDate();
  const byName = new Map<string, ParsedMemberExchangeRow[]>();
  for (const row of rows) {
    if (duplicateRows.has(row.rowNumber) || ambiguousRows.has(row.rowNumber)) {
      continue;
    }
    const name = normalized(row.values.CustomerName);
    if (!name) continue;
    byName.set(name, [...(byName.get(name) || []), row]);
  }

  for (const group of Array.from(byName.values())) {
    const activeRows = group.filter(
      (row) => clean(row.values.ExpiryDate1) >= today
    );
    if (activeRows.length === 0) continue;

    for (const row of group) {
      const expiry = clean(row.values.ExpiryDate1);
      if (!expiry || expiry >= today) continue;
      const rowEvidence = sourceEvidence(row);
      if (!rowEvidence.dob || !rowEvidence.id) continue;

      const matches = activeRows.filter((candidate) => {
        const candidateEvidence = sourceEvidence(candidate);
        return (
          candidate.rowNumber !== row.rowNumber &&
          candidateEvidence.dob === rowEvidence.dob &&
          Boolean(candidateEvidence.id) &&
          candidateEvidence.id === rowEvidence.id
        );
      });

      if (matches.length === 1) redundantRows.add(row.rowNumber);
    }
  }

  return { duplicateRows, ambiguousRows, redundantRows };
}

function classifyRows(
  parsed: ParsedMemberExchangeFile,
  batchId: string,
  existingRows: ExistingMemberDbRow[],
  indexes: ReturnType<typeof createMemberIndexes>,
  appliedLegacyLineage: AppliedLegacyLineage
) {
  const sourceScanCounts = new Map<string, number>();
  const sourcePkCounts = new Map<string, number>();

  for (const row of parsed.rows) {
    const scan3 = legacyScanKey(source(row, "Scan3"));
    if (scan3) sourceScanCounts.set(scan3, (sourceScanCounts.get(scan3) || 0) + 1);
    const pk = normalized(row.values.pkCustomer);
    if (pk) sourcePkCounts.set(pk, (sourcePkCounts.get(pk) || 0) + 1);
  }

  const legacySource =
    parsed.mode === "legacy_22"
      ? preclassifyLegacy22Source(parsed.rows)
      : {
          duplicateRows: new Set<number>(),
          ambiguousRows: new Set<number>(),
          redundantRows: new Set<number>(),
        };

  const seenFingerprint = new Set<string>();
  const staged: StagedImportRow[] = [];
  const reviews: ReviewItem[] = [];
  const previewIssues: MemberImportIssuePreview[] = [];
  const counts: Record<MemberImportAction, number> = {
    new: 0,
    update: 0,
    unchanged: 0,
    conflict: 0,
    invalid: 0,
    duplicate: 0,
    redundant: 0,
    rejected: 0,
  };
  const matchedMembers = new Set<string>();
  const warningSourceRows = new Set<number>();
  let cardRows = 0;
  let blankCardRows = 0;

  function addReview(item: ReviewItem) {
    reviews.push(item);
    if (previewIssues.length < 100) {
      previewIssues.push({
        rowNumber: item.source_row_number || 0,
        action: item.review_type,
        blocking: item.blocking,
        memberNumber: item.member_number || "",
        cardBarcode: item.legacy_scan3 || "",
        customerName: item.customer_name || "",
        gym: item.gym || "",
        pkCustomer: item.pk_customer || "",
        issue: item.issue,
      });
    }
  }

  for (const row of parsed.rows) {
    const v = row.values;
    const memberNumber = clean(v.MembershipNumber).toUpperCase();
    const legacyPk = clean(v.pkCustomer);
    const normalizedPk = normalized(legacyPk);
    const scan3 = legacyScanKey(source(row, "Scan3") || v.CardBarcode);
    const incoming = incomingFromRow(row, parsed.mode);
    if (parsed.mode === "legacy_22") incoming.cardBarcode = "";

    if (scan3) cardRows += 1;
    else blankCardRows += 1;

    const fp = fingerprint(row);
    let action: MemberImportAction = "new";
    let matchedMemberId: string | null = null;
    let issue = blockingRowIssue(row, parsed.mode);
    const formulaWarnings = nonBlockingFormulaIssues(row, parsed.mode);

    if (
      seenFingerprint.has(fp) ||
      legacySource.duplicateRows.has(row.rowNumber)
    ) {
      action = "duplicate";
      issue =
        "Duplicate old-system source record skipped. The richer/corroborated record is retained.";
    } else {
      seenFingerprint.add(fp);
    }

    if (
      action !== "duplicate" &&
      legacySource.redundantRows.has(row.rowNumber)
    ) {
      action = "redundant";
      issue =
        "Older expired record for the same documented person skipped; the current active record is retained.";
    }

    if (
      action !== "duplicate" &&
      action !== "redundant" &&
      !identityName(incoming) &&
      parsed.mode === "legacy_22"
    ) {
      action = "rejected";
      issue =
        "Legacy source row has no customer name/surname. It is retained in the import audit but is not created as a BGM member.";
    }

    const ambiguousLegacyIdentity =
      action !== "duplicate" &&
      action !== "redundant" &&
      action !== "rejected" &&
      parsed.mode === "legacy_22" &&
      legacySource.ambiguousRows.has(row.rowNumber);

    if (
      action !== "duplicate" &&
      action !== "redundant" &&
      action !== "rejected"
    ) {
      if (issue) {
        action = "invalid";
      } else if (!identityName(incoming)) {
        action = "invalid";
        issue = "CustomerName and CompanyName are blank.";
      } else if (parsed.mode === "legacy_22") {
        const hasUnknownLegacyGym = Boolean(clean(v.pkCustomer)) && !clean(v.Gym);
        const noIdentityEvidence =
          !clean(source(row, "DOB")) &&
          !clean(source(row, "IDCard")) &&
          !clean(v.Email) &&
          !sourcePhone(row);

        if (hasUnknownLegacyGym && !clean(v.ExpiryDate1) && noIdentityEvidence) {
          action = "rejected";
          issue =
            "Legacy source row has an unrecognised pkCustomer prefix, no authoritative ExpiryDate and no supporting identity/contact evidence. It is retained in audit but not created as a BGM member.";
        }

        if (action === "rejected") {
          // Do not attempt member matching for rejected legacy junk/test rows.
        } else {
        const candidates = uniqueMembers([
          ...(indexes.byLegacy.get(legacyKey(v.Gym, v.pkCustomer)) || []),
          ...(indexes.byLegacyPk.get(normalizedPk) || []),
          ...(scan3 ? indexes.byLegacyScan.get(scan3) || [] : []),
          ...(source(row, "IDCard") ? indexes.byIdNumber.get(normalized(source(row, "IDCard"))) || [] : []),
          ...(indexes.byNameEmail.get(nameEmailKey(v.CustomerName, v.Email)) || []),
          ...(indexes.byNameDob.get(nameDobKey(v.CustomerName, source(row, "DOB"))) || []),
        ]);

        const priorMemberId = priorAppliedLegacyMember(
          fp,
          row,
          candidates,
          appliedLegacyLineage,
          indexes
        );
        const result = priorMemberId
          ? {
              action: "update" as MemberImportAction,
              matchedMemberId: priorMemberId,
              issue: "",
            }
          : legacy22Match(row, candidates, indexes);
        action = result.action;
        matchedMemberId = result.matchedMemberId;
        issue = result.issue;

        if (matchedMemberId) {
          const existing = indexes.rawById.get(matchedMemberId);
          const existingScan3 = indexes.scan3ByMemberId.get(matchedMemberId);
          if (!existing) {
            action = "conflict";
            issue = "Matched member disappeared during preview.";
            matchedMemberId = null;
          } else if (
            existing.cancellation_effective_date &&
            !sameLegacy22Values(row, existing, existingScan3)
          ) {
            action = "conflict";
            issue = "This member has a BGM cancellation recorded. Old-system data will not silently override it.";
          } else if (
            scan3 &&
            existingScan3 &&
            legacyScanKey(scan3) !== legacyScanKey(existingScan3)
          ) {
            action = "conflict";
            issue = "This member already has a different legacy Scan3. Review the card assignment instead of replacing it automatically.";
          } else {
            action = sameLegacy22Values(row, existing, existingScan3) ? "unchanged" : "update";
          }
        }

        if (ambiguousLegacyIdentity && !matchedMemberId && action === "new") {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: null,
            member_number: null,
            customer_name: nullable(v.CustomerName),
            gym: nullable(v.Gym),
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue:
              "Potential duplicate identity in the old source. This row is deliberately retained as a separate member pending Super Admin review, matching the authoritative historical import behavior.",
          });
        }

        if (hasUnknownLegacyGym && action !== "rejected") {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: matchedMemberId,
            member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
            customer_name: nullable(v.CustomerName),
            gym: null,
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue:
              "pkCustomer prefix is not part of the approved legacy gym mapping. The member is retained with Legacy Gym blank rather than guessing a gym.",
          });
        }
        }

        for (const formulaIssue of formulaWarnings) {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: matchedMemberId,
            member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
            customer_name: nullable(v.CustomerName),
            gym: nullable(v.Gym),
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue: `${formulaIssue.message || "Formula found in a contact-only field."} The formula value is ignored; this does not block the member import.`,
          });
        }

        const derivedStatus = statusFromExpiryDate(v.ExpiryDate1, todayMaltaDate());
        if (!clean(v.ExpiryDate1)) {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: matchedMemberId,
            member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
            customer_name: nullable(v.CustomerName),
            gym: nullable(v.Gym),
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue: "ExpiryDate is blank. The member is imported as Inactive and cannot be granted access until a valid expiry is recorded.",
          });
        }
        if (derivedStatus && sourceValidityMismatch(source(row, "ValidYN"), derivedStatus)) {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: matchedMemberId,
            member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
            customer_name: nullable(v.CustomerName),
            gym: nullable(v.Gym),
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue: "Old-system ValidYN disagrees with ExpiryDate. ExpiryDate is authoritative and determines Active/Inactive.",
          });
        }

        if (scan3 && (sourceScanCounts.get(scan3) || 0) > 1) {
          warningSourceRows.add(row.rowNumber);
          addReview({
            batch_id: batchId,
            review_type: "warning",
            blocking: false,
            source_row_number: row.rowNumber,
            member_id: matchedMemberId,
            member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
            customer_name: nullable(v.CustomerName),
            gym: nullable(v.Gym),
            pk_customer: nullable(v.pkCustomer),
            legacy_scan3: nullable(scan3),
            issue: "Scan3 is shared by more than one source row. Members are retained separately and the shared card remains available to the card-conflict review workflow.",
          });
        }

        if (normalizedPk && (sourcePkCounts.get(normalizedPk) || 0) > 1) {
          warningSourceRows.add(row.rowNumber);
        }
      } else if (memberNumber) {
        if (!/^BGM[0-9]{7}$/.test(memberNumber)) {
          action = "invalid";
          issue = "Invalid permanent BGM membership number.";
        } else {
          const existing = indexes.byMemberNumber.get(memberNumber);
          if (!existing) {
            action = "conflict";
            issue = "Supplied BGM number does not belong to any current member. Leave the number blank for a new member.";
          } else {
            const result = classifyExistingBgmMemberImport(incoming, existing);
            action = result.action === "update" ? "unchanged" : result.action;
            matchedMemberId = result.matchedMemberId;
            issue = result.issue;
          }
        }
      } else {
        const candidates = uniqueMembers([
          ...(indexes.byLegacy.get(legacyKey(v.Gym, v.pkCustomer)) || []),
          ...(indexes.byLegacyPk.get(normalizedPk) || []),
          ...(indexes.byNameEmail.get(nameEmailKey(v.CustomerName || v.CompanyName, v.Email)) || []),
        ]);
        const result = conservativeLegacyMatch(incoming, candidates);
        action = result.action;
        matchedMemberId = result.matchedMemberId;
        issue = result.issue;
        if (parsed.mode === "legacy_15" && matchedMemberId) action = "unchanged";
      }

      if (matchedMemberId && (action === "update" || action === "unchanged")) {
        if (matchedMembers.has(matchedMemberId)) {
          action = "conflict";
          issue = "More than one non-skipped incoming row matches this existing member.";
          matchedMemberId = null;
        } else {
          matchedMembers.add(matchedMemberId);
        }
      }
    }

    counts[action] += 1;
    const derivedStatus =
      parsed.mode === "legacy_22"
        ? statusFromExpiryDate(v.ExpiryDate1, todayMaltaDate())
        : statusFromLegacy(v.ValidYN, v.ExpiryDate1);

    const stagedRow: StagedImportRow = {
      batch_id: batchId,
      row_number: row.rowNumber,
      membership_number: nullable(memberNumber),
      card_barcode: null,
      legacy_scan3: parsed.mode === "legacy_22" ? nullable(scan3) : null,
      gym: nullable(v.Gym),
      pk_customer: nullable(v.pkCustomer),
      customer_name: nullable(v.CustomerName),
      company_name: nullable(v.CompanyName),
      surname: parsed.mode === "legacy_22" ? nullable(source(row, "Surname")) : null,
      address1: nullable(v.Address1),
      address2: nullable(v.Address2),
      town: nullable(v.Town),
      postcode: nullable(v.PostCode),
      country: parsed.mode === "legacy_22" ? nullable(source(row, "Country")) : null,
      gender: nullable(v.Gender),
      id_number: parsed.mode === "legacy_22" ? nullable(source(row, "IDCard")) : null,
      date_of_birth: parsed.mode === "legacy_22" ? nullable(source(row, "DOB")) : null,
      telephone_no_1: nullable(v.TelephoneNo1),
      telephone_no_2: nullable(v.TelephoneNo2),
      mobile: nullable(v.Mobile),
      email: nullable(v.Email),
      expiry_date: nullable(v.ExpiryDate1),
      valid_yn:
        derivedStatus === "active"
          ? "Valid"
          : derivedStatus === "inactive"
            ? "Not Valid"
            : nullable(normalizeLegacyValidity(v.ValidYN) || v.ValidYN),
      source_valid_yn: parsed.mode === "legacy_22" ? nullable(source(row, "ValidYN")) : null,
      source_data: parsed.mode === "legacy_22" ? row.sourceValues || null : null,
      source_fingerprint: fp,
      action,
      matched_member_id: matchedMemberId,
      issue: nullable(issue),
    };
    staged.push(stagedRow);

    if (action === "rejected") {
      addReview({
        batch_id: batchId,
        review_type: "rejected",
        blocking: false,
        source_row_number: row.rowNumber,
        member_id: null,
        member_number: null,
        customer_name: nullable(v.CustomerName || v.CompanyName),
        gym: nullable(v.Gym),
        pk_customer: nullable(v.pkCustomer),
        legacy_scan3: nullable(scan3),
        issue: issue || "Legacy source row rejected from member creation.",
      });
    }

    if (action === "conflict" || action === "invalid") {
      addReview({
        batch_id: batchId,
        review_type: action,
        blocking: true,
        source_row_number: row.rowNumber,
        member_id: matchedMemberId,
        member_number: matchedMemberId ? indexes.rawById.get(matchedMemberId)?.member_number || null : null,
        customer_name: nullable(v.CustomerName || v.CompanyName),
        gym: nullable(v.Gym),
        pk_customer: nullable(v.pkCustomer),
        legacy_scan3: nullable(scan3),
        issue: issue || "Review this row before import.",
      });
    }
  }

  const missingExisting = existingRows.filter((member) => !matchedMembers.has(member.id));
  for (const member of missingExisting) {
    addReview({
      batch_id: batchId,
      review_type: "missing_source",
      blocking: false,
      source_row_number: null,
      member_id: member.id,
      member_number: member.member_number,
      customer_name: member.full_name,
      gym: member.legacy_gym,
      pk_customer: member.legacy_pk_customer,
      legacy_scan3: indexes.scan3ByMemberId.get(member.id) || null,
      issue: "Existing BGM member is not present in this upload. The member is retained unchanged and is not deleted or deactivated.",
    });
  }

  return {
    staged,
    reviews,
    issues: previewIssues,
    counts,
    missingSourceRows: missingExisting.length,
    warningRows: warningSourceRows.size,
    cardRows,
    blankCardRows,
  };
}

async function insertStagingRows(supabase: SupabaseClient, rows: StagedImportRow[]) {
  for (let start = 0; start < rows.length; start += STAGING_CHUNK_SIZE * 4) {
    const chunks = Array.from({ length: 4 }, (_, index) =>
      rows.slice(start + index * STAGING_CHUNK_SIZE, start + (index + 1) * STAGING_CHUNK_SIZE)
    ).filter((chunk) => chunk.length > 0);
    const results = await Promise.all(chunks.map((chunk) => supabase.from("bgm_member_import_rows").insert(chunk)));
    for (const result of results) if (result.error) throw result.error;
  }
}

async function insertReviewItems(supabase: SupabaseClient, rows: ReviewItem[]) {
  for (let start = 0; start < rows.length; start += STAGING_CHUNK_SIZE) {
    const result = await supabase
      .from("bgm_member_import_review_items")
      .insert(rows.slice(start, start + STAGING_CHUNK_SIZE));
    if (result.error) throw result.error;
  }
}

export async function previewMemberImport({
  file,
  systemUserId,
  supabase,
}: {
  file: File;
  systemUserId: string;
  supabase: SupabaseClient;
}): Promise<MemberImportPreviewResult> {
  const { parsed, fileFormat } = await parseUploadedMembershipFile(file);
  if (parsed.rows.length === 0) throw new Error("The membership file does not contain any data rows.");

  const batchResult = await supabase
    .from("bgm_member_import_batches")
    .insert({
      created_by_system_user_id: systemUserId,
      filename: clean(file.name) || `membership-import.${fileFormat}`,
      file_format: fileFormat,
      import_mode: parsed.mode,
      total_rows: parsed.rows.length,
      converted_rows: parsed.rows.length,
    })
    .select("id")
    .single();

  if (batchResult.error) throw batchResult.error;
  const batchId = String(batchResult.data.id);

  try {
    const [existing, credentials, claims, appliedLegacyLineage] = await Promise.all([
      loadExistingMembers(supabase),
      loadExistingCardCredentials(supabase),
      loadLegacyClaims(supabase),
      loadAppliedLegacyLineage(supabase),
    ]);
    const indexes = createMemberIndexes(existing, credentials, claims);
    const classified = classifyRows(
      parsed,
      batchId,
      existing,
      indexes,
      appliedLegacyLineage
    );

    await insertStagingRows(supabase, classified.staged);
    if (classified.reviews.length) await insertReviewItems(supabase, classified.reviews);

    const updateResult = await supabase
      .from("bgm_member_import_batches")
      .update({
        converted_rows: classified.staged.length,
        new_rows: classified.counts.new,
        update_rows: classified.counts.update,
        unchanged_rows: classified.counts.unchanged,
        duplicate_rows: classified.counts.duplicate,
        redundant_rows: classified.counts.redundant,
        missing_source_rows: classified.missingSourceRows,
        warning_rows: classified.warningRows,
        conflict_rows: classified.counts.conflict,
        invalid_rows: classified.counts.invalid,
        rejected_rows: classified.counts.rejected,
      })
      .eq("id", batchId);
    if (updateResult.error) throw updateResult.error;

    return {
      batchId,
      filename: clean(file.name),
      fileFormat,
      importMode: parsed.mode,
      totalRows: parsed.rows.length,
      convertedRows: classified.staged.length,
      countVerified: classified.staged.length === parsed.rows.length,
      newRows: classified.counts.new,
      updateRows: classified.counts.update,
      unchangedRows: classified.counts.unchanged,
      duplicateRows: classified.counts.duplicate,
      redundantRows: classified.counts.redundant,
      missingSourceRows: classified.missingSourceRows,
      warningRows: classified.warningRows,
      conflictRows: classified.counts.conflict,
      invalidRows: classified.counts.invalid,
      rejectedRows: classified.counts.rejected,
      cardRows: classified.cardRows,
      blankCardRows: classified.blankCardRows,
      issues: classified.issues,
    };
  } catch (error) {
    await supabase.from("bgm_member_import_batches").update({ status: "failed" }).eq("id", batchId);
    throw error;
  }
}
