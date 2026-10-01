import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE = 1000;
const MAX_ROWS = 150000;
const PARTICIPANT_BATCH = 400;

type VoucherRow = {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  successful_uses: number;
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  enrollment_gym_id: string | null;
  activated_at: string | null;
  discount_code_snapshot: string | null;
  discount_percentage_snapshot: number | null;
  status: string | null;
};

type ParticipantRow = {
  application_id: string;
  first_name: string | null;
  last_name: string | null;
  id_number: string | null;
};

function normaliseCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function maltaDateFromInstant(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

async function allRows<T>(
  builder: (from: number, to: number) => PromiseLike<{ data: unknown; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const result = await builder(from, from + PAGE - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as T[];
    rows.push(...batch);
    if (rows.length > MAX_ROWS) {
      throw new Error("Voucher report is too large. Choose a shorter date range.");
    }
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function participantRowsForApplications(
  db: ReturnType<typeof getSupabaseAdmin>,
  applicationIds: string[]
) {
  const rows: ParticipantRow[] = [];
  for (let index = 0; index < applicationIds.length; index += PARTICIPANT_BATCH) {
    const ids = applicationIds.slice(index, index + PARTICIPANT_BATCH);
    if (ids.length === 0) continue;
    const result = await db
      .from("bgm_membership_application_members")
      .select("application_id,first_name,last_name,id_number")
      .in("application_id", ids)
      .order("participant_order");
    if (result.error) throw result.error;
    rows.push(...((result.data || []) as ParticipantRow[]));
  }
  return rows;
}

function effectiveStatus(voucher: VoucherRow, today: string) {
  if (!voucher.active) return { status: "inactive" as const, reason: "Disabled" };
  if (voucher.valid_from && voucher.valid_from > today) {
    return { status: "inactive" as const, reason: "Not started" };
  }
  if (voucher.valid_until && voucher.valid_until < today) {
    return { status: "inactive" as const, reason: "Expired" };
  }
  if (
    voucher.max_uses !== null &&
    Number(voucher.successful_uses || 0) >= voucher.max_uses
  ) {
    return { status: "inactive" as const, reason: "Usage limit reached" };
  }
  return { status: "active" as const, reason: "Available" };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const today = todayMaltaDate();
    const year = today.slice(0, 4);
    const from = request.nextUrl.searchParams.get("from") || `${year}-01-01`;
    const to = request.nextUrl.searchParams.get("to") || today;
    const requestedVoucher = normaliseCode(
      request.nextUrl.searchParams.get("voucher")
    );

    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json(
        { error: "Choose a valid voucher report date range." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const [voucherRows, gymRows] = await Promise.all([
      allRows<VoucherRow>((a, b) =>
        db
          .from("bgm_discount_codes")
          .select("id,code,percentage,active,valid_from,valid_until,max_uses,successful_uses,created_at,updated_at")
          .eq("percentage", 100)
          .order("code")
          .range(a, b)
      ),
      allRows<{ id: string; name: string }>((a, b) =>
        db.from("bgm_gyms").select("id,name").order("name").range(a, b)
      ),
    ]);

    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;

    const applications = await allRows<ApplicationRow>((a, b) => {
      let query = db
        .from("bgm_membership_applications")
        .select("id,enrollment_gym_id,activated_at,discount_code_snapshot,discount_percentage_snapshot,status")
        .eq("status", "activated")
        .eq("discount_percentage_snapshot", 100)
        .gte("activated_at", start)
        .lt("activated_at", end)
        .order("activated_at", { ascending: false })
        .range(a, b);

      if (requestedVoucher) {
        query = query.eq("discount_code_snapshot", requestedVoucher);
      }
      return query;
    });

    const applicationIds = applications.map((row) => row.id);
    const participants = await participantRowsForApplications(db, applicationIds);
    const participantsByApplication = new Map<string, ParticipantRow[]>();

    for (const participant of participants) {
      const list = participantsByApplication.get(participant.application_id) || [];
      list.push(participant);
      participantsByApplication.set(participant.application_id, list);
    }

    const gymNames = Object.fromEntries(
      gymRows.map((gym) => [gym.id, gym.name || gym.id])
    );

    const members = applications.flatMap((application) => {
      const code = normaliseCode(application.discount_code_snapshot);
      if (!code || !application.activated_at) return [];
      return (participantsByApplication.get(application.id) || []).map((participant) => ({
        applicationId: application.id,
        voucherCode: code,
        firstName: String(participant.first_name || "").trim(),
        lastName: String(participant.last_name || "").trim(),
        idNumber: String(participant.id_number || "").trim(),
        enrollmentDate: maltaDateFromInstant(application.activated_at!),
        enrollmentGymId: application.enrollment_gym_id || null,
        enrollmentGymName:
          gymNames[String(application.enrollment_gym_id || "")] ||
          application.enrollment_gym_id ||
          "Unknown gym",
      }));
    });

    const memberCountByVoucher = new Map<string, number>();
    for (const member of members) {
      memberCountByVoucher.set(
        member.voucherCode,
        (memberCountByVoucher.get(member.voucherCode) || 0) + 1
      );
    }

    const configuredByCode = new Map(
      voucherRows.map((voucher) => [normaliseCode(voucher.code), voucher])
    );

    // Historical 100% voucher usage remains reportable even if a code was
    // later removed from Membership Settings.
    const historicalCodes = new Set(
      applications
        .map((application) => normaliseCode(application.discount_code_snapshot))
        .filter(Boolean)
    );

    const allCodes = new Set([
      ...configuredByCode.keys(),
      ...historicalCodes,
    ]);

    let vouchers = Array.from(allCodes).map((code) => {
      const configured = configuredByCode.get(code);
      if (!configured) {
        return {
          id: null,
          code,
          percentage: 100,
          status: "inactive",
          statusReason: "Removed from settings",
          configuredActive: false,
          validFrom: null,
          validUntil: null,
          maxUses: null,
          successfulUses: 0,
          membersInRange: memberCountByVoucher.get(code) || 0,
        };
      }

      const effective = effectiveStatus(configured, today);
      return {
        id: configured.id,
        code,
        percentage: configured.percentage,
        status: effective.status,
        statusReason: effective.reason,
        configuredActive: configured.active,
        validFrom: configured.valid_from,
        validUntil: configured.valid_until,
        maxUses: configured.max_uses,
        successfulUses: Number(configured.successful_uses || 0),
        membersInRange: memberCountByVoucher.get(code) || 0,
      };
    });

    if (requestedVoucher) {
      vouchers = vouchers.filter((voucher) => voucher.code === requestedVoucher);
    }

    vouchers.sort((a, b) => a.code.localeCompare(b.code));
    members.sort((a, b) =>
      a.voucherCode.localeCompare(b.voucherCode) ||
      b.enrollmentDate.localeCompare(a.enrollmentDate) ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName)
    );

    return NextResponse.json({
      from,
      to,
      generatedAt: new Date().toISOString(),
      vouchers,
      members,
      summary: {
        totalVouchers: vouchers.length,
        activeVouchers: vouchers.filter((voucher) => voucher.status === "active").length,
        inactiveVouchers: vouchers.filter((voucher) => voucher.status === "inactive").length,
        membersInRange: members.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load voucher analytics." },
      { status: 500 }
    );
  }
}
