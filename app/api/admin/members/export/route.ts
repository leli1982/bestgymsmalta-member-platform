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

// Read-only reconciliation report. Keep the legacy exchange contract intact.
async function loadCurrentMembersCsv() {
  const db = getSupabaseAdmin();
  const activeCards = await loadActiveCardMap();
  const legacyCards = new Map<string, { card: string; status: string }>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await db.from("bgm_legacy_card_claims").select("member_id,scan3,assignment_status")
      .order("member_id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (page.error) throw page.error;
    for (const row of page.data || []) legacyCards.set(row.member_id, { card: row.scan3, status: row.assignment_status });
    if ((page.data || []).length < PAGE_SIZE) break;
  }
  const gyms = await db.from("bgm_gyms").select("id,name");
  if (gyms.error) throw gyms.error;
  const gymNames = new Map((gyms.data || []).map(row => [row.id, row.name]));
  const today = todayMaltaDate();
  const columns = ["BGMNumber","LegacyPkCustomer","PhysicalCard","LegacyScan3","LegacyCardStatus","FullName","Gym","Status","ExpiryDate","CancellationEffectiveDate","AccessScope","AccessGym","Email","Mobile","Phone","PhotoAssigned","AppEnrolled","CreatedAt","UpdatedAt","ArchivedAt"];
  // Protect spreadsheet applications against formula interpretation. The
  // report is not intended for re-import through the exchange template.
  const cell = (value: unknown) => {
    let v = text(value);
    if (/^[\s]*[=+@-]/.test(v) || /^[\t\r\n]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const lines = [columns.map(cell).join(",")];
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await db.from("bgm_members")
      .select("id,member_number,legacy_pk_customer,full_name,legacy_gym,enrollment_gym_id,status,membership_expiry,cancellation_effective_date,access_scope,access_gym_id,email,mobile,phone,official_photo_path,app_enrolled,created_at,updated_at,archived_at")
      .order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (page.error) throw page.error;
    for (const m of page.data || []) {
      if (seen.has(m.id)) throw new Error("Member data changed during export. Retry download.");
      seen.add(m.id);
      const legacy = legacyCards.get(m.id);
      const valid = !m.archived_at && evaluateBarcodeAccess({
        member: { status: m.status, membershipExpiry: m.membership_expiry, cancellationEffectiveDate: m.cancellation_effective_date }, today,
      }).granted;
      lines.push([m.member_number,m.legacy_pk_customer,activeCards.get(m.id),legacy?.card,legacy?.status,m.full_name,
        gymNames.get(m.enrollment_gym_id) || m.legacy_gym, m.archived_at ? "Archived" : valid ? "Active" : "Expired",m.membership_expiry,m.cancellation_effective_date,
        m.access_scope,gymNames.get(m.access_gym_id) || m.access_gym_id,m.email,m.mobile,m.phone,
        m.official_photo_path ? "Yes" : "No",m.app_enrolled ? "Yes" : "No",m.created_at,m.updated_at,m.archived_at].map(cell).join(","));
    }
    if ((page.data || []).length < PAGE_SIZE) break;
  }
  const count = await db.from("bgm_members").select("id", { count: "exact", head: true });
  if (count.error) throw count.error;
  if (count.count !== seen.size) throw new Error("Membership count changed during export. Retry download.");
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
      return new NextResponse(csv, { headers: {
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
