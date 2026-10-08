import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import {
  summariseVoucherAttendance,
  voucherAttendanceStatus,
  type VoucherAttendanceCheckin,
  type VoucherEligibilityPeriod,
} from "@/lib/voucherAttendanceCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE = 1000;
const MAX_ROWS = 150000;
const ID_BATCH = 400;

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

type MembershipRow = {
  id: string;
  application_id: string;
  start_date: string;
  expiry_date: string;
  enrollment_gym_id: string | null;
  status: string | null;
  cancellation_effective_date: string | null;
};

type MembershipMemberRow = {
  membership_id: string;
  member_id: string;
};

type MemberRow = {
  id: string;
  member_number: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  id_number: string | null;
};

type CheckinRow = {
  id: string;
  member_id: string;
  gym_id: string;
  checkin_at: string;
  source: string | null;
};

type LegacyCorrectionRow = {
  id: string;
  voucher_code: string;
  voucher_percentage: number;
  member_enrollment_date_snapshot: string | null;
  enrollment_gym_id_snapshot: string | null;
  member_first_name: string | null;
  member_last_name: string | null;
  member_id_number: string | null;
  applied_at: string;
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

function previousCalendarDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function splitName(fullName: string | null) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
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

async function rowsForIds<T>(
  ids: string[],
  loader: (ids: string[]) => PromiseLike<{ data: unknown; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += ID_BATCH) {
    const batchIds = ids.slice(index, index + ID_BATCH);
    if (!batchIds.length) continue;
    const result = await loader(batchIds);
    if (result.error) throw result.error;
    rows.push(...((result.data || []) as T[]));
    if (rows.length > MAX_ROWS) {
      throw new Error("Voucher report is too large. Choose a shorter date range.");
    }
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
  if (voucher.max_uses !== null && Number(voucher.successful_uses || 0) >= voucher.max_uses) {
    return { status: "inactive" as const, reason: "Usage limit reached" };
  }
  return { status: "active" as const, reason: "Available" };
}

function eligibilityForMembership(membership: MembershipRow): VoucherEligibilityPeriod | null {
  let endDate = membership.expiry_date;
  if (membership.cancellation_effective_date) {
    const lastActiveDate = previousCalendarDate(membership.cancellation_effective_date);
    if (lastActiveDate < endDate) endDate = lastActiveDate;
  }
  if (membership.start_date > endDate) return null;
  return { startDate: membership.start_date, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const today = todayMaltaDate();
    const year = today.slice(0, 4);
    const from = request.nextUrl.searchParams.get("from") || `${year}-01-01`;
    const to = request.nextUrl.searchParams.get("to") || today;
    const requestedVoucher = normaliseCode(request.nextUrl.searchParams.get("voucher"));

    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json(
        { error: "Choose a valid voucher report date range." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const [voucherRows, gymRows] = await Promise.all([
      allRows<VoucherRow>((a, b) =>
        db.from("bgm_discount_codes")
          .select("id,code,percentage,active,valid_from,valid_until,max_uses,successful_uses,created_at,updated_at")
          .order("code").range(a, b)
      ),
      allRows<{ id: string; name: string }>((a, b) =>
        db.from("bgm_gyms").select("id,name").order("name").range(a, b)
      ),
    ]);

    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;
    const gymNames = Object.fromEntries(gymRows.map((gym) => [gym.id, gym.name || gym.id]));

    // Voucher attribution is historical application data, while attendance eligibility
    // is based on the normalized membership contract that application produced.
    const applicationRows = await allRows<ApplicationRow>((a, b) => {
      let query = db.from("bgm_membership_applications")
        .select("id,enrollment_gym_id,activated_at,discount_code_snapshot,discount_percentage_snapshot,status")
        .eq("status", "activated")
        .not("discount_code_snapshot", "is", null)
        .order("activated_at", { ascending: false })
        .range(a, b);
      if (requestedVoucher) query = query.eq("discount_code_snapshot", requestedVoucher);
      return query;
    });
    const applications = applicationRows.filter((row) => Boolean(normaliseCode(row.discount_code_snapshot)));
    const applicationById = new Map(applications.map((row) => [row.id, row]));

    // Contracts overlap the selected report period; enrollment/activation date alone
    // must not determine whether a voucher member is expected to attend.
    const memberships = await allRows<MembershipRow>((a, b) =>
      db.from("bgm_memberships")
        .select("id,application_id,start_date,expiry_date,enrollment_gym_id,status,cancellation_effective_date")
        .lte("start_date", to)
        .gte("expiry_date", from)
        .order("start_date")
        .range(a, b)
    );
    const voucherMemberships = memberships.filter((membership) => applicationById.has(membership.application_id));
    const membershipIds = voucherMemberships.map((row) => row.id);

    const membershipMembers = await rowsForIds<MembershipMemberRow>(membershipIds, (ids) =>
      db.from("bgm_membership_members")
        .select("membership_id,member_id")
        .in("membership_id", ids)
    );
    const memberIds = Array.from(new Set(membershipMembers.map((row) => row.member_id)));
    const realMembers = await rowsForIds<MemberRow>(memberIds, (ids) =>
      db.from("bgm_members")
        .select("id,member_number,first_name,last_name,full_name,id_number")
        .in("id", ids)
    );
    const memberById = new Map(realMembers.map((row) => [row.id, row]));

    const checkins = memberIds.length
      ? await allRows<CheckinRow>((a, b) =>
          db.from("bgm_member_checkins")
            .select("id,member_id,gym_id,checkin_at,source")
            .in("member_id", memberIds)
            .in("source", ["barcode", "nfc"])
            .gte("checkin_at", start)
            .lt("checkin_at", end)
            .order("checkin_at")
            .range(a, b)
        )
      : [];

    const linksByMembership = new Map<string, MembershipMemberRow[]>();
    for (const link of membershipMembers) {
      const list = linksByMembership.get(link.membership_id) || [];
      list.push(link);
      linksByMembership.set(link.membership_id, list);
    }
    const checkinsByMember = new Map<string, CheckinRow[]>();
    for (const checkin of checkins) {
      const list = checkinsByMember.get(checkin.member_id) || [];
      list.push(checkin);
      checkinsByMember.set(checkin.member_id, list);
    }

    type AttendanceAccumulator = {
      member: MemberRow;
      application: ApplicationRow;
      enrollmentGymId: string | null;
      enrollmentDate: string;
      eligibility: VoucherEligibilityPeriod[];
    };
    const attendanceByVoucherMember = new Map<string, AttendanceAccumulator>();

    for (const membership of voucherMemberships) {
      const application = applicationById.get(membership.application_id);
      if (!application) continue;
      const voucherCode = normaliseCode(application.discount_code_snapshot);
      const eligibility = eligibilityForMembership(membership);
      if (!voucherCode || !eligibility) continue;

      for (const link of linksByMembership.get(membership.id) || []) {
        const member = memberById.get(link.member_id);
        if (!member) continue;
        const key = `${voucherCode}:${member.id}`;
        const existing = attendanceByVoucherMember.get(key);
        if (existing) {
          existing.eligibility.push(eligibility);
        } else {
          attendanceByVoucherMember.set(key, {
            member,
            application,
            enrollmentGymId: membership.enrollment_gym_id || application.enrollment_gym_id || null,
            enrollmentDate: application.activated_at ? maltaDateFromInstant(application.activated_at) : membership.start_date,
            eligibility: [eligibility],
          });
        }
      }
    }

    const normalizedMembers = Array.from(attendanceByVoucherMember.values()).map((entry) => {
      const application = entry.application;
      const voucherCode = normaliseCode(application.discount_code_snapshot);
      const fallbackName = splitName(entry.member.full_name);
      const memberCheckins: VoucherAttendanceCheckin[] = (checkinsByMember.get(entry.member.id) || []).map((row) => ({
        id: row.id,
        memberId: row.member_id,
        gymId: row.gym_id,
        gymName: gymNames[row.gym_id] || row.gym_id,
        checkinAt: row.checkin_at,
      }));
      const attendance = summariseVoucherAttendance({
        reportFrom: from,
        reportTo: to,
        eligibility: entry.eligibility,
        checkins: memberCheckins,
      });
      const attendanceStatus = voucherAttendanceStatus(attendance);
      return {
        applicationId: application.id,
        memberId: entry.member.id,
        memberNumber: String(entry.member.member_number || "").trim(),
        voucherCode,
        voucherPercentage: application.discount_percentage_snapshot === null
          ? null
          : Number(application.discount_percentage_snapshot),
        firstName: String(entry.member.first_name || fallbackName.firstName).trim(),
        lastName: String(entry.member.last_name || fallbackName.lastName).trim(),
        idNumber: String(entry.member.id_number || "").trim(),
        enrollmentDate: entry.enrollmentDate,
        enrollmentGymId: entry.enrollmentGymId,
        enrollmentGymName: entry.enrollmentGymId
          ? (gymNames[entry.enrollmentGymId] || entry.enrollmentGymId)
          : "Unknown gym",
        membershipStart: entry.eligibility.map((period) => period.startDate).sort()[0] || null,
        membershipExpiry: entry.eligibility.map((period) => period.endDate).sort().at(-1) || null,
        ...attendance,
        attendanceStatus,
      };
    }).filter((member) => member.eligibleDays > 0);

    const legacyRows = await allRows<LegacyCorrectionRow>((a, b) => {
      let query = db.from("bgm_legacy_member_voucher_corrections")
        .select("id,voucher_code,voucher_percentage,member_enrollment_date_snapshot,enrollment_gym_id_snapshot,member_first_name,member_last_name,member_id_number,applied_at")
        .order("applied_at", { ascending: false })
        .range(a, b);
      if (requestedVoucher) query = query.eq("voucher_code", requestedVoucher);
      return query;
    });
    const legacyCorrections = legacyRows.filter((row) => {
      const date = row.member_enrollment_date_snapshot || maltaDateFromInstant(row.applied_at);
      return date >= from && date <= to;
    });
    const legacyMembers = legacyCorrections.map((row) => ({
      applicationId: `legacy:${row.id}`,
      memberId: null,
      memberNumber: "",
      voucherCode: normaliseCode(row.voucher_code),
      voucherPercentage: Number(row.voucher_percentage),
      firstName: String(row.member_first_name || "").trim(),
      lastName: String(row.member_last_name || "").trim(),
      idNumber: String(row.member_id_number || "").trim(),
      enrollmentDate: row.member_enrollment_date_snapshot || maltaDateFromInstant(row.applied_at),
      enrollmentGymId: row.enrollment_gym_id_snapshot || null,
      enrollmentGymName: gymNames[String(row.enrollment_gym_id_snapshot || "")] || row.enrollment_gym_id_snapshot || "Unknown gym",
      membershipStart: null,
      membershipExpiry: null,
      eligibleDays: 0,
      attendedDays: 0,
      missedDays: 0,
      attendancePercentage: 0,
      totalVisits: 0,
      lastVisitAt: null,
      gymBreakdown: [],
      attendanceStatus: "not-eligible" as const,
      attendanceNote: "Historical voucher correction has no normalized membership/check-in link.",
    }));

    const members = [...normalizedMembers, ...legacyMembers];
    const memberCountByVoucher = new Map<string, number>();
    for (const member of members) {
      memberCountByVoucher.set(member.voucherCode, (memberCountByVoucher.get(member.voucherCode) || 0) + 1);
    }

    const configuredByCode = new Map(voucherRows.map((voucher) => [normaliseCode(voucher.code), voucher]));
    const historicalPercentageByCode = new Map<string, number | null>();
    for (const application of applications) {
      const code = normaliseCode(application.discount_code_snapshot);
      if (!code || historicalPercentageByCode.has(code)) continue;
      historicalPercentageByCode.set(
        code,
        application.discount_percentage_snapshot === null ? null : Number(application.discount_percentage_snapshot)
      );
    }
    for (const correction of legacyRows) {
      const code = normaliseCode(correction.voucher_code);
      if (!code || historicalPercentageByCode.has(code)) continue;
      historicalPercentageByCode.set(code, Number(correction.voucher_percentage));
    }

    const allCodes = new Set([
      ...Array.from(configuredByCode.keys()),
      ...Array.from(historicalPercentageByCode.keys()),
    ]);
    let vouchers = Array.from(allCodes).map((code) => {
      const configured = configuredByCode.get(code);
      if (!configured) {
        return {
          id: null,
          code,
          percentage: historicalPercentageByCode.get(code) ?? null,
          status: "inactive" as const,
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
    if (requestedVoucher) vouchers = vouchers.filter((voucher) => voucher.code === requestedVoucher);

    vouchers.sort((a, b) => a.code.localeCompare(b.code));
    members.sort((a, b) =>
      a.voucherCode.localeCompare(b.voucherCode) ||
      String(b.enrollmentDate || "").localeCompare(String(a.enrollmentDate || "")) ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName)
    );

    const attendanceEligible = normalizedMembers.filter((member) => member.eligibleDays > 0);
    const noShows = attendanceEligible.filter((member) => member.attendanceStatus === "no-show");

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
        attendanceEligibleMembers: attendanceEligible.length,
        noShowMembers: noShows.length,
        noShowPercentage: attendanceEligible.length
          ? Math.round((noShows.length / attendanceEligible.length) * 1_000) / 10
          : 0,
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
