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
        "id, full_name, email, legacy_gym, legacy_pk_customer, company_name, address_line_1, address_line_2, town, postcode, gender, telephone_no_1, telephone_no_2, mobile, membership_expiry, status"
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
  const byCardBarcode = new Map<string, ExistingMemberForMatch[]>();
  const byLegacy = new Map<string, ExistingMemberForMatch[]>();
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
    const cardBarcode = clean(member.cardBarcode);
    if (cardBarcode) {
      const list = byCardBarcode.get(cardBarcode) || [];
      list.push(member);
      byCardBarcode.set(cardBarcode, list);
    }

    const key = legacyKey(member.legacyGym, member.legacyPkCustomer);
    if (key) {
      const list = byLegacy.get(key) || [];
      list.push(member);
      byLegacy.set(key, list);
    }
  }

  return { byCardBarcode, byLegacy, occupiedBarcodes };
}

function fileFormulaIssue(row: ParsedMemberExchangeRow) {
  if (!row.issues.length) return "";
  return row.issues
    .map((issue) => issue.message || `${issue.kind} in ${issue.column}`)
    .join(" ");
}

function classifyRows(
  parsed: ParsedMemberExchangeFile,
  batchId: string,
  indexes: ReturnType<typeof createMemberIndexes>
) {
  const explicitCardCounts = new Map<string, number>();
  for (const row of parsed.rows) {
    const barcode = normalizeBarcodePayload(row.values.CardBarcode);
    if (barcode) {
      explicitCardCounts.set(barcode, (explicitCardCounts.get(barcode) || 0) + 1);
    }
  }

  const staged: StagedImportRow[] = [];
  const issues: MemberImportIssuePreview[] = [];
  const counts: Record<MemberImportAction, number> = {
    new: 0,
    update: 0,
    unchanged: 0,
    conflict: 0,
    invalid: 0,
  };
  let cardRows = 0;
  let blankCardRows = 0;

  for (const row of parsed.rows) {
    const values = row.values;
    const cardBarcode = normalizeBarcodePayload(values.CardBarcode);
    const incoming = incomingFromRow(row);
    let action: MemberImportAction;
    let matchedMemberId: string | null = null;
    let issue = fileFormulaIssue(row);

    if (cardBarcode) cardRows += 1;
    else blankCardRows += 1;

    if (issue) {
      action = "invalid";
    } else if (
      cardBarcode &&
      (explicitCardCounts.get(cardBarcode) || 0) > 1
    ) {
      action = "conflict";
      issue = `CardBarcode ${cardBarcode} appears more than once in this upload.`;
    } else if (
      cardBarcode &&
      indexes.occupiedBarcodes.has(cardBarcode) &&
      (indexes.byCardBarcode.get(cardBarcode) || []).length === 0
    ) {
      action = "conflict";
      issue = `CardBarcode ${cardBarcode} has already been issued or reserved and cannot be reassigned.`;
    } else {
      const classification = classifyMemberImportRow({
        incoming,
        byCardBarcode: indexes.byCardBarcode.get(cardBarcode) || [],
        legacyCandidates:
          indexes.byLegacy.get(legacyKey(values.Gym, values.pkCustomer)) || [],
      });
      action = classification.action;
      matchedMemberId = classification.matchedMemberId;
      issue = classification.issue;
    }

    counts[action] += 1;

    const stagedRow: StagedImportRow = {
      batch_id: batchId,
      row_number: row.rowNumber,
      card_barcode: nullable(cardBarcode),
      gym: nullable(values.Gym),
      pk_customer: nullable(values.pkCustomer),
      customer_name: nullable(values.CustomerName),
      company_name: nullable(values.CompanyName),
      address1: nullable(values.Address1),
      address2: nullable(values.Address2),
      town: nullable(values.Town),
      postcode: nullable(values.PostCode),
      gender: nullable(values.Gender),
      telephone_no_1: nullable(values.TelephoneNo1),
      telephone_no_2: nullable(values.TelephoneNo2),
      mobile: nullable(values.Mobile),
      email: nullable(values.Email),
      expiry_date: nullable(values.ExpiryDate1),
      valid_yn: nullable(normalizeLegacyValidity(values.ValidYN) || values.ValidYN),
      source_fingerprint: fingerprint(row),
      action,
      matched_member_id: matchedMemberId,
      issue: nullable(issue),
    };
    staged.push(stagedRow);

    if ((action === "conflict" || action === "invalid") && issues.length < 100) {
      issues.push({
        rowNumber: row.rowNumber,
        action,
        cardBarcode,
        customerName: clean(values.CustomerName) || clean(values.CompanyName),
        gym: clean(values.Gym),
        pkCustomer: clean(values.pkCustomer),
        issue: issue || "Review this row before import.",
      });
    }
  }

  return { staged, issues, counts, cardRows, blankCardRows };
}

async function insertStagingRows(
  supabase: SupabaseClient,
  rows: StagedImportRow[]
) {
  for (let start = 0; start < rows.length; start += STAGING_CHUNK_SIZE) {
    const result = await supabase
      .from("bgm_member_import_rows")
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
