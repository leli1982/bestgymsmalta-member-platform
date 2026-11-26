import { NextRequest, NextResponse } from "next/server";
import {
  MEMBER_EXCHANGE_HEADERS,
  emptyMemberExchangeValues,
  type ParsedMemberExchangeRow,
} from "@/lib/memberExchangeCore";
import { serializeMemberExchangeCsv } from "@/lib/memberExchangeCsv";
import {
  buildMemberExchangeXlsx,
  exchangeValuesRow,
} from "@/lib/memberExchangeWorkbook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { evaluateBarcodeAccess } from "@/lib/barcodeAccessCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { CURRENT_CSV_SCHEMA, CURRENT_CSV_COLUMNS, CURRENT_CSV_HEADERS, currentCsvDisplay, currentCsvCell, type CurrentCsvRow } from "@/lib/currentMemberCsvCore";
import { createCurrentCsvSnapshot } from "@/lib/currentMemberCsvSignature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 1000;
const MEMBER_EXPORT_SELECT =
  "id, member_number, legacy_gym, legacy_pk_customer, full_name, company_name, address_line_1, address_line_2, town, postcode, gender, telephone_no_1, telephone_no_2, mobile, email, membership_expiry, status, cancellation_effective_date";

type ExportMember = {
  id: string;
  member_number: string;
  legacy_gym: string | null;
  legacy_pk_customer: string | null;
  full_name: string | null;
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  gender: string | null;
  telephone_no_1: string | null;
  telephone_no_2: string | null;
  mobile: string | null;
  email: string | null;
  membership_expiry: string | null;
  status: string | null;
  cancellation_effective_date: string | null;
};

type ActiveCardRow = {
  member_id: string | null;
  barcode_value: string;
};

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function toExchangeRow(
  member: ExportMember,
  cardBarcode: string,
  rowNumber: number
) {
  const values = emptyMemberExchangeValues();
  values.MembershipNumber = member.member_number;
  values.CardBarcode = cardBarcode;
  values.Gym = text(member.legacy_gym);
  values.pkCustomer = cardBarcode || text(member.legacy_pk_customer);
  values.CustomerName = text(member.full_name);
  values.CompanyName = text(member.company_name);
  values.Address1 = text(member.address_line_1);
  values.Address2 = text(member.address_line_2);
  values.Town = text(member.town);
  values.PostCode = text(member.postcode);
  values.Gender = text(member.gender);
  values.TelephoneNo1 = text(member.telephone_no_1);
  values.TelephoneNo2 = text(member.telephone_no_2);
  values.Mobile = text(member.mobile);
  values.Email = text(member.email);
  values.ExpiryDate1 = text(member.membership_expiry);
  const effectiveStatus = evaluateBarcodeAccess({
    member: {
      status: member.status,
      membershipExpiry: member.membership_expiry,
      cancellationEffectiveDate: member.cancellation_effective_date,
    },
    today: todayMaltaDate(),
  });
  values.ValidYN = effectiveStatus.granted ? "Valid" : "Not Valid";
  return exchangeValuesRow(values, rowNumber);
}

async function loadActiveCardMap() {
  const supabase = getSupabaseAdmin();
  const activeCardByMemberId = new Map<string, string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_member_card_credentials")
      .select("member_id, barcode_value")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    const page = (result.data || []) as ActiveCardRow[];
    for (const card of page) {
      if (card.member_id) activeCardByMemberId.set(card.member_id, card.barcode_value);
    }
    if (page.length < PAGE_SIZE) break;
  }

  return activeCardByMemberId;
}

async function loadAllMembers(): Promise<ParsedMemberExchangeRow[]> {
  const supabase = getSupabaseAdmin();
  const activeCardByMemberId = await loadActiveCardMap();
  const rows: ParsedMemberExchangeRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_members")
      .select(MEMBER_EXPORT_SELECT)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    const page = (result.data || []) as ExportMember[];
    page.forEach((member) =>
      rows.push(
        toExchangeRow(
          member,
          activeCardByMemberId.get(member.id) || "",
          rows.length + 2
        )
      )
    );
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

// Full member snapshot, distinct from the original exchange format.
// Do not export password hashes, session secrets or payment credentials.
async function loadCurrentMembersCsv() {
  const db = getSupabaseAdmin();
  const membersById = new Map<string, Record<string, any>>();
  const membershipsById = new Map<string, Record<string, any>>();
  const membershipsByMember = new Map<string, Record<string, any>[]>();
  const currentCards = new Map<string, string[]>();
  const cardHistory = new Map<string, Record<string, any>[]>();
  const legacyHistory = new Map<string, Record<string, any>[]>();
  const append = <T,>(map: Map<string, T[]>, id: string, value: T) => {
    const list = map.get(id) || [];
    list.push(value);
    map.set(id, list);
  };
  const readAll = async (table: string, columns: string, sort: string[], consume: (row: any) => void) => {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = db.from(table).select(columns);
      for (const column of sort) query = query.order(column, { ascending: true });
      const page = await query.range(from, from + PAGE_SIZE - 1);
      if (page.error) throw page.error;
      for (const row of page.data || []) consume(row);
      if ((page.data || []).length < PAGE_SIZE) break;
    }
  };
  await readAll("bgm_memberships",
    "id,application_id,membership_type,duration_key,start_date,expiry_date,enrollment_gym_id,status,cancellation_effective_date,voucher_extension_months_snapshot,voucher_base_expiry_date_snapshot,voucher_terms_snapshot,created_at,updated_at,activation_staff_name",
    ["id"], row => membershipsById.set(row.id, row));
  await readAll("bgm_membership_members", "membership_id,member_id,member_role,created_at",
    ["member_id","membership_id"], row => {
      const membership = membershipsById.get(row.membership_id);
      if (!membership) throw new Error("Membership history changed during export. Retry download.");
      append(membershipsByMember,row.member_id,{...membership,member_role:row.member_role,linked_at:row.created_at});
    });
  await readAll("bgm_member_card_credentials",
    "id,member_id,barcode_value,status,reserved_at,activated_at,retired_at,retired_reason,application_member_id,updated_at",
    ["id"], row => {
      if (!row.member_id) return;
      append(cardHistory,row.member_id,row);
      if (row.status === "active") append(currentCards,row.member_id,row.barcode_value);
    });
  await readAll("bgm_legacy_card_claims",
    "member_id,scan3,assignment_status,source_scan3,source_row_number,import_batch_id,updated_at",
    ["member_id","scan3"], row => append(legacyHistory,row.member_id,row));
  const gyms = await db.from("bgm_gyms").select("id,name");
  if (gyms.error) throw gyms.error;
  const gymNames = new Map((gyms.data || []).map(row => [row.id, row.name]));
  const today = todayMaltaDate();
  const memberColumns = [
    "id","member_number","legacy_pk_customer","full_name","first_name","last_name","company_name","address_line_1","address_line_2","town","postcode","country","gender",
    "date_of_birth","id_number","next_of_kin","email","mobile","phone","telephone_no_1","telephone_no_2","notes",
    "enrollment_gym_id","legacy_gym","status","membership_expiry","enrollment_date","membership_period","cancellation_effective_date","cancellation_reason","cancellation_recorded_at",
    "access_scope","access_gym_id","pending_access_scope","pending_access_gym_id","pending_access_effective_date",
    "official_photo_path","app_enrolled","app_enrolled_at","username","last_login_at","created_at","updated_at","archived_at","archived_reason","real_import_batch_id","real_import_row_number",
  ];
  await readAll("bgm_members", memberColumns.join(","), ["id"], row => {
    if (membersById.has(row.id)) throw new Error("Member data changed during export. Retry download.");
    membersById.set(row.id,row);
  });
  const count = await db.from("bgm_members").select("id", { count: "exact", head: true });
  if (count.error) throw count.error;
  if (count.count !== membersById.size) throw new Error("Membership count changed during export. Retry download.");
  const lines = [CURRENT_CSV_HEADERS.map(currentCsvCell).join(",")];
  for (const m of Array.from(membersById.values())) {
    const history = (membershipsByMember.get(m.id) || []).slice().sort((a,b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) || String(a.id).localeCompare(String(b.id)));
    // Do not invent dates/types for legacy records that never had structured membership terms.
    const matchingTerm = history.find(t => t.expiry_date === m.membership_expiry && t.status === "active") ||
      history.find(t => t.expiry_date === m.membership_expiry) || null;
    const legacy = legacyHistory.get(m.id) || [];
    const currentLegacy = legacy.filter(row => row.assignment_status === "active");
    const valid = !m.archived_at && evaluateBarcodeAccess({
      member: { status: m.status, membershipExpiry: m.membership_expiry, cancellationEffectiveDate: m.cancellation_effective_date }, today,
    }).granted;
    const values = [
      CURRENT_CSV_SCHEMA,today,m.member_number,m.id,m.legacy_pk_customer,(currentCards.get(m.id)||[]).join(" | "),currentLegacy.map(row=>row.scan3).join(" | "),currentLegacy.length ? "active" : legacy.length ? "removed" : "",
      m.full_name,m.first_name,m.last_name,m.company_name,m.address_line_1,m.address_line_2,m.town,m.postcode,m.country,m.gender,m.date_of_birth,m.id_number,m.next_of_kin,
      m.email,m.mobile,m.phone,m.telephone_no_1,m.telephone_no_2,m.notes,m.enrollment_gym_id,gymNames.get(m.enrollment_gym_id),m.legacy_gym,
      m.archived_at ? "Archived" : valid ? "Active" : "Expired",m.status,matchingTerm?.membership_type,matchingTerm?.duration_key,matchingTerm?.start_date,matchingTerm?.expiry_date,m.membership_expiry,m.enrollment_date,m.membership_period,
      matchingTerm?.id,matchingTerm?.member_role,matchingTerm?.status,m.cancellation_effective_date,m.cancellation_reason,m.cancellation_recorded_at,
      m.access_scope,m.access_gym_id,gymNames.get(m.access_gym_id),m.pending_access_scope,m.pending_access_gym_id,m.pending_access_effective_date,
      matchingTerm?.voucher_extension_months_snapshot,matchingTerm?.voucher_base_expiry_date_snapshot,matchingTerm?.voucher_terms_snapshot == null ? "" : JSON.stringify(matchingTerm.voucher_terms_snapshot),
      m.official_photo_path,m.official_photo_path ? "Yes" : "No",m.app_enrolled ? "Yes" : "No",m.app_enrolled_at,m.username,m.last_login_at,
      m.created_at,m.updated_at,m.archived_at,m.archived_reason,m.real_import_batch_id,m.real_import_row_number,
      JSON.stringify(history),JSON.stringify(cardHistory.get(m.id)||[]),JSON.stringify(legacy),
    ].map(currentCsvDisplay);
    if (values.length !== CURRENT_CSV_COLUMNS.length) throw new Error("Unexpected current-members CSV column count.");
    const row = Object.fromEntries(CURRENT_CSV_COLUMNS.map((column,i)=>[column,values[i]])) as CurrentCsvRow;
    const snapshot = createCurrentCsvSnapshot(row,matchingTerm?.updated_at || null);
    lines.push([...values,snapshot.original,snapshot.signature].map(currentCsvCell).join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.export");
    if (auth.error) return auth.error;

    const requestedFormat = request.nextUrl.searchParams.get("format") || "xlsx";
    const format = requestedFormat.toLowerCase();
    if (format === "current-csv") {
      if (!auth.context?.isSuperAdmin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      const csv = await loadCurrentMembersCsv();
      // Stream the full export rather than depend on the hosting platform's
      // buffered response size limit for tens of thousands of members.
      const bytes = new TextEncoder().encode(csv);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let offset=0;offset<bytes.length;offset+=128*1024)
            controller.enqueue(bytes.subarray(offset,offset+128*1024));
          controller.close();
        },
      });
      return new NextResponse(stream, { headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bgm-current-members-${todayMaltaDate()}.csv"`,
        "Cache-Control": "no-store",
      } });
    }
    if (format !== "xlsx" && format !== "csv") {
      return NextResponse.json(
        { error: "Export format must be xlsx or csv." },
        { status: 400 }
      );
    }

    if (
      MEMBER_EXCHANGE_HEADERS.length !== 16 ||
      MEMBER_EXCHANGE_HEADERS[0] !== "MembershipNumber" ||
      MEMBER_EXCHANGE_HEADERS[1] !== "Gym"
    ) {
      throw new Error("Unexpected membership exchange contract.");
    }

    const rows = await loadAllMembers();
    const date = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csv = serializeMemberExchangeCsv(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bgm-members-${date}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = await buildMemberExchangeXlsx(rows);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bgm-members-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Membership export failed:", error);
    return NextResponse.json(
      { error: "Could not export members." },
      { status: 500 }
    );
  }
}
