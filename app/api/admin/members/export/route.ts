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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 1000;
const MEMBER_EXPORT_SELECT =
  "id, legacy_gym, legacy_pk_customer, full_name, company_name, address_line_1, address_line_2, town, postcode, gender, telephone_no_1, telephone_no_2, mobile, email, membership_expiry, status";

type ExportMember = {
  id: string;
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
  values.CardBarcode = cardBarcode;
  values.Gym = text(member.legacy_gym);
  values.pkCustomer = text(member.legacy_pk_customer);
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
  values.ValidYN = member.status === "active" ? "Valid" : "Not Valid";
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.export");
    if (auth.error) return auth.error;

    const requestedFormat = request.nextUrl.searchParams.get("format") || "xlsx";
    const format = requestedFormat.toLowerCase();
    if (format !== "xlsx" && format !== "csv") {
      return NextResponse.json(
        { error: "Export format must be xlsx or csv." },
        { status: 400 }
      );
    }

    if (
      MEMBER_EXCHANGE_HEADERS.length !== 16 ||
      MEMBER_EXCHANGE_HEADERS[0] !== "CardBarcode"
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
