import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RANGE_DAYS = 366;
const PAGE_SIZE = 1000;

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function daysInclusive(from: string, to: string) {
  return Math.floor((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000) + 1;
}

function mondayOfWeek(value: string) {
  const date = parseDate(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDate(date);
}

function firstOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function maltaDateFromInstant(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

function activeMemberQuery(db: ReturnType<typeof getSupabaseAdmin>) {
  const today = todayMaltaDate();
  return db
    .from("bgm_members")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("archived_at", null)
    .or(`membership_expiry.is.null,membership_expiry.gte.${today}`)
    .or(`cancellation_effective_date.is.null,cancellation_effective_date.gt.${today}`);
}

async function exactCount(query: any) {
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function loadActivationInstants(
  db: ReturnType<typeof getSupabaseAdmin>,
  start: string,
  end: string
) {
  const rows: Array<{ app_enrolled_at: string | null }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await db
      .from("bgm_members")
      .select("app_enrolled_at")
      .eq("app_enrolled", true)
      .not("app_enrolled_at", "is", null)
      .gte("app_enrolled_at", start)
      .lt("app_enrolled_at", end)
      .order("app_enrolled_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const batch = result.data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const today = todayMaltaDate();
    const requestedFrom = String(request.nextUrl.searchParams.get("from") || addDays(today, -29));
    const requestedTo = String(request.nextUrl.searchParams.get("to") || today);

    if (!isValidCalendarDate(requestedFrom) || !isValidCalendarDate(requestedTo)) {
      return NextResponse.json({ error: "A valid date range is required." }, { status: 400, headers: noStore });
    }

    const rangeDays = daysInclusive(requestedFrom, requestedTo);
    if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Choose a date range between 1 and ${MAX_RANGE_DAYS} days.` },
        { status: 400, headers: noStore }
      );
    }

    const db = getSupabaseAdmin();
    const weekStart = mondayOfWeek(today);
    const monthStart = firstOfMonth(today);
    const selectedRange = { start: maltaDayUtcRange(requestedFrom).start, end: maltaDayUtcRange(requestedTo).end };
    const todayRange = maltaDayUtcRange(today);
    const weekRange = { start: maltaDayUtcRange(weekStart).start, end: todayRange.end };
    const monthRange = { start: maltaDayUtcRange(monthStart).start, end: todayRange.end };

    const [
      totalEnrolled,
      trackedEnrolled,
      activeMembers,
      activeEnrolled,
      activatedToday,
      activatedThisWeek,
      activatedThisMonth,
      dailyRows,
    ] = await Promise.all([
      exactCount(
        db.from("bgm_members").select("id", { count: "exact", head: true }).eq("app_enrolled", true)
      ),
      exactCount(
        db
          .from("bgm_members")
          .select("id", { count: "exact", head: true })
          .eq("app_enrolled", true)
          .not("app_enrolled_at", "is", null)
      ),
      exactCount(activeMemberQuery(db)),
      exactCount(activeMemberQuery(db).eq("app_enrolled", true)),
      exactCount(
        db
          .from("bgm_members")
          .select("id", { count: "exact", head: true })
          .eq("app_enrolled", true)
          .gte("app_enrolled_at", todayRange.start)
          .lt("app_enrolled_at", todayRange.end)
      ),
      exactCount(
        db
          .from("bgm_members")
          .select("id", { count: "exact", head: true })
          .eq("app_enrolled", true)
          .gte("app_enrolled_at", weekRange.start)
          .lt("app_enrolled_at", weekRange.end)
      ),
      exactCount(
        db
          .from("bgm_members")
          .select("id", { count: "exact", head: true })
          .eq("app_enrolled", true)
          .gte("app_enrolled_at", monthRange.start)
          .lt("app_enrolled_at", monthRange.end)
      ),
      loadActivationInstants(db, selectedRange.start, selectedRange.end),
    ]);

    const counts = new Map<string, number>();
    for (const row of dailyRows) {
      const instant = String(row.app_enrolled_at || "");
      if (!instant) continue;
      const date = maltaDateFromInstant(instant);
      counts.set(date, (counts.get(date) || 0) + 1);
    }

    const daily: Array<{ date: string; count: number }> = [];
    for (let date = requestedFrom; date <= requestedTo; date = addDays(date, 1)) {
      daily.push({ date, count: counts.get(date) || 0 });
    }

    const adoptionPct = activeMembers > 0
      ? Math.round((activeEnrolled / activeMembers) * 1000) / 10
      : 0;

    return NextResponse.json(
      {
        appAdoption: {
          totalEnrolled,
          trackedEnrolled,
          historicalUntracked: Math.max(0, totalEnrolled - trackedEnrolled),
          activeMembers,
          activeEnrolled,
          adoptionPct,
          notEnrolledActive: Math.max(0, activeMembers - activeEnrolled),
          activatedToday,
          activatedThisWeek,
          activatedThisMonth,
          from: requestedFrom,
          to: requestedTo,
          daily,
        },
        generatedAt: new Date().toISOString(),
      },
      { headers: noStore }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load app adoption analytics." },
      { status: 500, headers: noStore }
    );
  }
}
