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
  action: "conflict" | "invalid" | "warning" | "missing_source";
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
  review_type: "conflict" | "invalid" | "warning" | "missing_source";
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
        "id, member_number, full_name, email, legacy_gym, legacy_pk_customer, company_name, address_line_1, address_line_2, town, postcode, country, gender, telephone_no_1, telephone_no_2, mobile, id_number, date_of_birth, membership_expiry, status, cancellation_effective_date"
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
    const scan3 = normalizeBarcodePayload(claim.scan3);
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
    rawById,
    scan3ByMemberId,
    occupiedBarcodes,
  };
}

function fileFormulaIssue(row: ParsedMemberExchangeRow) {
  if (!row.issues.length) return "";
  return row.issues.map((issue) => issue.message || `${issue.kind} in ${issue.column}`).join(" ");
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
  const wantedScan = normalizeBarcodePayload(source(row, "Scan3"));

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
    return {
      action: "conflict" as MemberImportAction,
      matchedMemberId: null,
      issue: "Possible existing member found, but the old-system identity cannot be matched safely.",
    };
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

  const scan3 = normalizeBarcodePayload(source(row, "Scan3"));
  const scanMatches = !scan3 || !existingScan3 || scan3 === existingScan3;
  return baseMatches && scanMatches;
}

function strongSourceIdentityKey(row: ParsedMemberExchangeRow) {
  const name = normalized(row.values.CustomerName);
  const pk = normalized(row.values.pkCustomer);
  const id = normalized(source(row, "IDCard"));
  const dob = source(row, "DOB");
  const email = clean(row.values.Email).toLocaleLowerCase("en");
  const support = id || dob || email;
  if (!name || !pk || !support) return "";
  return [normalized(row.values.Gym), pk, name, id, dob, email].join("\u0000");
}

function classifyRows(
  parsed: ParsedMemberExchangeFile,
  batchId: string,
  existingRows: ExistingMemberDbRow[],
  indexes: ReturnType<typeof createMemberIndexes>
) {
  const fingerprints = new Map<string, number>();
  const identityRows = new Map<string, ParsedMemberExchangeRow[]>();
  const sourceScanCounts = new Map<string, number>();
  const sourcePkCounts = new Map<string, number>();

  for (const row of parsed.rows) {
    const fp = fingerprint(row);
    fingerprints.set(fp, (fingerprints.get(fp) || 0) + 1);
    const identity = parsed.mode === "legacy_22" ? strongSourceIdentityKey(row) : "";
    if (identity) identityRows.set(identity, [...(identityRows.get(identity) || []), row]);
    const scan3 = normalizeBarcodePayload(source(row, "Scan3"));
    if (scan3) sourceScanCounts.set(scan3, (sourceScanCounts.get(scan3) || 0) + 1);
    const pk = normalized(row.values.pkCustomer);
    if (pk) sourcePkCounts.set(pk, (sourcePkCounts.get(pk) || 0) + 1);
  }

  const redundantRows = new Set<number>();
  for (const rows of identityRows.values()) {
    if (rows.length < 2) continue;
    const uniqueFingerprints = new Set(rows.map(fingerprint));
    if (uniqueFingerprints.size < 2) continue;
    const sorted = [...rows].sort((a, b) => clean(b.values.ExpiryDate1).localeCompare(clean(a.values.ExpiryDate1)));
    const newest = sorted[0];
    for (const row of sorted.slice(1)) {
      if (clean(row.values.ExpiryDate1) < clean(newest.values.ExpiryDate1)) redundantRows.add(row.rowNumber);
    }
  }

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
    const scan3 = normalizeBarcodePayload(source(row, "Scan3") || v.CardBarcode);
    const incoming = incomingFromRow(row, parsed.mode);
    if (parsed.mode === "legacy_22") incoming.cardBarcode = "";

    if (scan3) cardRows += 1;
    else blankCardRows += 1;

    const fp = fingerprint(row);
    let action: MemberImportAction = "new";
    let matchedMemberId: string | null = null;
    let issue = fileFormulaIssue(row);

    if (seenFingerprint.has(fp)) {
      action = "duplicate";
      issue = "Exact duplicate source row skipped; the first identical row is retained.";
    } else {
      seenFingerprint.add(fp);
    }

    if (action !== "duplicate" && redundantRows.has(row.rowNumber)) {
      action = "redundant";
      issue = "Older redundant record for the same person skipped; the row with the latest ExpiryDate is retained.";
    }

    if (action !== "duplicate" && action !== "redundant") {
      if (issue) {
        action = "invalid";
      } else if (!identityName(incoming)) {
        action = "invalid";
        issue = "CustomerName and Surname/CompanyName are blank.";
      } else if (parsed.mode === "legacy_22") {
        const candidates = uniqueMembers([
          ...(indexes.byLegacy.get(legacyKey(v.Gym, v.pkCustomer)) || []),
          ...(indexes.byLegacyPk.get(normalizedPk) || []),
          ...(scan3 ? indexes.byLegacyScan.get(scan3) || [] : []),
          ...(source(row, "IDCard") ? indexes.byIdNumber.get(normalized(source(row, "IDCard"))) || [] : []),
          ...(indexes.byNameEmail.get(nameEmailKey(v.CustomerName, v.Email)) || []),
          ...(indexes.byNameDob.get(nameDobKey(v.CustomerName, source(row, "DOB"))) || []),
        ]);

        const result = legacy22Match(row, candidates, indexes);
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
          } else if (scan3 && existingScan3 && scan3 !== existingScan3) {
            action = "conflict";
            issue = "This member already has a different legacy Scan3. Review the card assignment instead of replacing it automatically.";
          } else {
            action = sameLegacy22Values(row, existing, existingScan3) ? "unchanged" : "update";
          }
        }

        const derivedStatus = statusFromExpiryDate(v.ExpiryDate1, todayMaltaDate());
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
    const [existing, credentials, claims] = await Promise.all([
      loadExistingMembers(supabase),
      loadExistingCardCredentials(supabase),
      loadLegacyClaims(supabase),
    ]);
    const indexes = createMemberIndexes(existing, credentials, claims);
    const classified = classifyRows(parsed, batchId, existing, indexes);

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
      cardRows: classified.cardRows,
      blankCardRows: classified.blankCardRows,
      issues: classified.issues,
    };
  } catch (error) {
    await supabase.from("bgm_member_import_batches").update({ status: "failed" }).eq("id", batchId);
    throw error;
  }
}
