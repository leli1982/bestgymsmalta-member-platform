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
import {
  classifyMemberImportRow,
  classifyExistingBgmMemberImport,
  type ExistingMemberForMatch,
  type IncomingMemberForMatch,
  type MemberImportAction,
} from "@/lib/memberImportMatchCore";

const PAGE_SIZE = 1000;
const STAGING_CHUNK_SIZE = 500;

export type MemberImportIssuePreview = {
  rowNumber: number;
  action: "conflict" | "invalid";
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
  newRows: number;
  updateRows: number;
  unchangedRows: number;
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
  gender: string | null;
  telephone_no_1: string | null;
  telephone_no_2: string | null;
  mobile: string | null;
  membership_expiry: string | null;
  status: string | null;
};

type ExistingCardCredentialDbRow = {
  barcode_value: string;
  member_id: string | null;
  status: "reserved" | "active" | "retired";
};

type StagedImportRow = {
  batch_id: string;
  membership_number: string | null;
  row_number: number;
  card_barcode: string | null;
  gym: string | null;
  pk_customer: string | null;
  customer_name: string | null;
  company_name: string | null;
  address1: string | null;
  address2: string | null;
  town: string | null;
  postcode: string | null;
  gender: string | null;
  telephone_no_1: string | null;
  telephone_no_2: string | null;
  mobile: string | null;
  email: string | null;
  expiry_date: string | null;
  valid_yn: string | null;
  source_fingerprint: string;
  action: MemberImportAction;
  matched_member_id: string | null;
  issue: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

function legacyKey(gym: unknown, pkCustomer: unknown) {
  const gymKey = clean(gym).toLocaleLowerCase("en");
  const pkKey = clean(pkCustomer);
  if (!gymKey || !pkKey) return "";
  return `${gymKey}\u0000${pkKey}`;
}

function fingerprint(row: ParsedMemberExchangeRow) {
  const orderedValues = MEMBER_EXCHANGE_HEADERS.map(
    (header) => row.values[header] ?? ""
  );
  return createHash("sha256").update(JSON.stringify(orderedValues)).digest("hex");
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

function incomingFromRow(row: ParsedMemberExchangeRow): IncomingMemberForMatch {
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
    status: statusFromLegacy(values.ValidYN, values.ExpiryDate1),
  };
}

async function parseUploadedMembershipFile(file: File) {
  const filename = clean(file.name);
  const lower = filename.toLocaleLowerCase("en");

  if (lower.endsWith(".xlsx")) {
    const parsed = await parseMemberExchangeXlsx(
      Buffer.from(await file.arrayBuffer())
    );
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
        "id, member_number, full_name, email, legacy_gym, legacy_pk_customer, company_name, address_line_1, address_line_2, town, postcode, gender, telephone_no_1, telephone_no_2, mobile, membership_expiry, status"
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

function createMemberIndexes(
  existing: ExistingMemberDbRow[],
  credentials: ExistingCardCredentialDbRow[]
) {
  const byMemberNumber = new Map<string, ExistingMemberForMatch>();
  const byCardBarcode = new Map<string, ExistingMemberForMatch[]>();
  const byLegacy = new Map<string, ExistingMemberForMatch[]>();
  const byLegacyPk = new Map<string, ExistingMemberForMatch[]>();
  const byNameEmail = new Map<string, ExistingMemberForMatch[]>();
  const occupiedBarcodes = new Set<string>();
  const activeCardByMemberId = new Map<string, string>();

  for (const credential of credentials) {
    const barcode = normalizeBarcodePayload(credential.barcode_value);
    if (!barcode) continue;
    occupiedBarcodes.add(barcode);
    if (credential.status === "active" && credential.member_id) {
      activeCardByMemberId.set(credential.member_id, barcode);
    }
  }

  for (const raw of existing) {
    const member = dbMemberToMatch(raw, activeCardByMemberId);
    byMemberNumber.set(raw.member_number.trim().toUpperCase(), member);
    const identity = [clean(member.fullName).replace(/\s+/g," ").toLocaleLowerCase("en"),clean(member.email).toLocaleLowerCase("en")].join("|");
    if (clean(member.email) && clean(member.fullName)) byNameEmail.set(identity,[...(byNameEmail.get(identity)||[]),member]);
    const cardBarcode = clean(member.cardBarcode);
    if (cardBarcode) {
      const list = byCardBarcode.get(cardBarcode) || [];
      list.push(member);
      byCardBarcode.set(cardBarcode, list);
    }

    const pk = clean(member.legacyPkCustomer);
    if (pk) byLegacyPk.set(pk, [...(byLegacyPk.get(pk) || []), member]);
    const key = legacyKey(member.legacyGym, member.legacyPkCustomer);
    if (key) {
      const list = byLegacy.get(key) || [];
      list.push(member);
      byLegacy.set(key, list);
    }
  }

  return { byMemberNumber, byCardBarcode, byLegacy, byLegacyPk, byNameEmail, occupiedBarcodes };
}

function fileFormulaIssue(row: ParsedMemberExchangeRow) {
  if (!row.issues.length) return "";
  return row.issues
    .map((issue) => issue.message || `${issue.kind} in ${issue.column}`)
    .join(" ");
}

function identityName(row: IncomingMemberForMatch | ExistingMemberForMatch) {
  const name = "fullName" in row ? row.fullName : (row.customerName || row.companyName);
  return clean(name).replace(/\s+/g, " ").toLocaleLowerCase("en");
}
function conservativeLegacyMatch(
  incoming: IncomingMemberForMatch,
  candidates: ExistingMemberForMatch[]
): { action: MemberImportAction; matchedMemberId: string | null; issue: string } {
  if (!identityName(incoming)) return { action: "invalid", matchedMemberId: null, issue: "CustomerName and CompanyName are both blank." };
  if (candidates.length === 0) return { action: "new", matchedMemberId: null, issue: "" };
  const name = identityName(incoming);
  const matching = Array.from(new Map(candidates.map(x => [x.id, x])).values()).filter(x => {
    if (!name || identityName(x) !== name) return false;
    const a = clean(incoming.email).toLocaleLowerCase("en");
    const b = clean(x.email).toLocaleLowerCase("en");
    return !(a && b && a !== b);
  });
  if (matching.length === 1) return { action: "unchanged", matchedMemberId: matching[0].id, issue: "" };
  return { action: "conflict", matchedMemberId: null,
    issue: "Legacy gym/card reference is ambiguous or conflicts with an existing member. Review rather than guessing or creating a duplicate." };
}
function classifyRows(
  parsed: ParsedMemberExchangeFile,
  batchId: string,
  indexes: ReturnType<typeof createMemberIndexes>
) {
  const bgmCounts = new Map<string, number>();
  const sourceIdentityCounts = new Map<string, number>();
  for (const row of parsed.rows) {
    const value = row.values;
    const id = clean(value.MembershipNumber).toUpperCase();
    if (id) bgmCounts.set(id, (bgmCounts.get(id) || 0) + 1);
    const key = [clean(value.Gym).toLocaleLowerCase("en"), clean(value.pkCustomer), clean(value.CustomerName || value.CompanyName).replace(/\s+/g, " ").toLocaleLowerCase("en"), clean(value.Email).toLocaleLowerCase("en")].join("\\u0000");
    sourceIdentityCounts.set(key, (sourceIdentityCounts.get(key) || 0) + 1);
  }
  const staged: StagedImportRow[] = [];
  const issues: MemberImportIssuePreview[] = [];
  const counts: Record<MemberImportAction, number> = { new: 0, update: 0, unchanged: 0, conflict: 0, invalid: 0 };
  const alreadyMatchedMembers = new Set<string>();
  let cardRows = 0;
  let blankCardRows = 0;
  for (const row of parsed.rows) {
    const v = row.values;
    const memberNumber = clean(v.MembershipNumber).toUpperCase();
    const legacyPk = normalizeBarcodePayload(v.pkCustomer);
    const knownCard = indexes.byCardBarcode.get(legacyPk) || [];
    const candidates = [
      ...(indexes.byLegacy.get(legacyKey(v.Gym, v.pkCustomer)) || []),
      ...knownCard,
      ...(indexes.byLegacyPk.get(legacyPk) || []),
      ...(indexes.byNameEmail.get([clean(v.CustomerName || v.CompanyName).replace(/\s+/g," ").toLocaleLowerCase("en"),clean(v.Email).toLocaleLowerCase("en")].join("|")) || []),
    ];
    const incoming = incomingFromRow(row);
    // The physical legacy card number is not a globally unique person identifier.
    // Preserve it in pk_customer, but do not automatically mint active card credentials
    // from the legacy workbook; reception's conservative legacy fallback handles it.
    incoming.cardBarcode = "";
    let action: MemberImportAction;
    let matchedMemberId: string | null = null;
    let issue = fileFormulaIssue(row);
    const sourceKey = [clean(v.Gym).toLocaleLowerCase("en"), legacyPk, clean(v.CustomerName || v.CompanyName).replace(/\s+/g, " ").toLocaleLowerCase("en"), clean(v.Email).toLocaleLowerCase("en")].join("\\u0000");
    if (legacyPk) cardRows += 1; else blankCardRows += 1;
    if (issue) action = "invalid";
    else if (!identityName(incoming)) { action = "invalid"; issue = "CustomerName and CompanyName are both blank."; }
    else if (memberNumber && !/^BGM[0-9]{7}$/.test(memberNumber)) { action = "invalid"; issue = "Invalid permanent BGM membership number."; }
    else if (memberNumber && (bgmCounts.get(memberNumber) || 0) > 1) { action = "conflict"; issue = "Duplicate permanent BGM number in uploaded sheet."; }
    else if (!memberNumber && (sourceIdentityCounts.get(sourceKey) || 0) > 1) { action = "conflict"; issue = "Repeated gym/card/name/email identity in the workbook; review the records individually."; }
    else if (memberNumber) {
      const existing = indexes.byMemberNumber.get(memberNumber);
      if (!existing) { action = "conflict"; issue = "Supplied BGM number does not belong to any current member. Leave the number blank for a new member."; }
      else {
        const result = classifyExistingBgmMemberImport(incoming, existing);
        action = result.action === "update" ? "unchanged" : result.action;
        matchedMemberId = result.matchedMemberId; issue = result.issue;
      }
    } else {
      const result = conservativeLegacyMatch(incoming, candidates);
      action = result.action; matchedMemberId = result.matchedMemberId; issue = result.issue;
      // Original legacy imports only add missing people; a safely matched member
      // must retain their current profile, expiry, BGM ID, memberships and payments.
      if (parsed.mode === "legacy_15" && matchedMemberId) action = "unchanged";
    }
    if (matchedMemberId && (action === "update" || action === "unchanged")) {
      if (alreadyMatchedMembers.has(matchedMemberId)) {
        action = "conflict"; issue = "More than one incoming row matches this existing member."; matchedMemberId = null;
      } else alreadyMatchedMembers.add(matchedMemberId);
    }
    counts[action] += 1;
    const stagedRow: StagedImportRow = {
      batch_id: batchId, row_number: row.rowNumber, membership_number: nullable(memberNumber),
      card_barcode: null, gym: nullable(v.Gym), pk_customer: nullable(v.pkCustomer),
      customer_name: nullable(v.CustomerName), company_name: nullable(v.CompanyName),
      address1: nullable(v.Address1), address2: nullable(v.Address2), town: nullable(v.Town),
      postcode: nullable(v.PostCode), gender: nullable(v.Gender), telephone_no_1: nullable(v.TelephoneNo1),
      telephone_no_2: nullable(v.TelephoneNo2), mobile: nullable(v.Mobile), email: nullable(v.Email),
      expiry_date: nullable(v.ExpiryDate1), valid_yn: nullable(normalizeLegacyValidity(v.ValidYN) || v.ValidYN),
      source_fingerprint: fingerprint(row), action, matched_member_id: matchedMemberId, issue: nullable(issue),
    };
    staged.push(stagedRow);
    if ((action === "conflict" || action === "invalid") && issues.length < 100) {
      issues.push({ rowNumber: row.rowNumber, action, cardBarcode: legacyPk,
        customerName: clean(v.CustomerName || v.CompanyName), gym: clean(v.Gym),
        pkCustomer: clean(v.pkCustomer), issue: issue || "Review this row before import." });
    }
  }
  return { staged, issues, counts, cardRows, blankCardRows };
}

async function insertStagingRows(
  supabase: SupabaseClient,
  rows: StagedImportRow[]
) {
  // Four bounded parallel writes keep the 25k-row legacy workbook practical
  // without opening hundreds of concurrent PostgREST connections.
  for (let start = 0; start < rows.length; start += STAGING_CHUNK_SIZE * 4) {
    const chunks = Array.from({ length: 4 }, (_, index) =>
      rows.slice(start + index * STAGING_CHUNK_SIZE, start + (index + 1) * STAGING_CHUNK_SIZE)
    ).filter(chunk => chunk.length > 0);
    const results = await Promise.all(chunks.map(chunk =>
      supabase.from("bgm_member_import_rows").insert(chunk)
    ));
    for (const result of results) if (result.error) throw result.error;
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

  if (parsed.rows.length === 0) {
    throw new Error("The membership file does not contain any data rows.");
  }

  const batchResult = await supabase
    .from("bgm_member_import_batches")
    .insert({
      created_by_system_user_id: systemUserId,
      filename: clean(file.name) || `membership-import.${fileFormat}`,
      file_format: fileFormat,
      import_mode: parsed.mode,
      total_rows: parsed.rows.length,
    })
    .select("id")
    .single();

  if (batchResult.error) throw batchResult.error;
  const batchId = String(batchResult.data.id);

  try {
    const [existing, credentials] = await Promise.all([
      loadExistingMembers(supabase),
      loadExistingCardCredentials(supabase),
    ]);
    const classified = classifyRows(
      parsed,
      batchId,
      createMemberIndexes(existing, credentials)
    );
    await insertStagingRows(supabase, classified.staged);

    const updateResult = await supabase
      .from("bgm_member_import_batches")
      .update({
        new_rows: classified.counts.new,
        update_rows: classified.counts.update,
        unchanged_rows: classified.counts.unchanged,
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
      newRows: classified.counts.new,
      updateRows: classified.counts.update,
      unchangedRows: classified.counts.unchanged,
      conflictRows: classified.counts.conflict,
      invalidRows: classified.counts.invalid,
      cardRows: classified.cardRows,
      blankCardRows: classified.blankCardRows,
      issues: classified.issues,
    };
  } catch (error) {
    await supabase
      .from("bgm_member_import_batches")
      .update({ status: "failed" })
      .eq("id", batchId);
    throw error;
  }
}
