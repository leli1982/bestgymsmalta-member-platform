import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import { AUDIT_SELECT, applyAuditFilters, readAuditFilters } from "@/lib/auditTrail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function weekStart(today: string) {
  const date = new Date(today + "T12:00:00Z");
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

async function countQuery(db: ReturnType<typeof getSupabaseAdmin>, from?: string, to?: string, category?: string) {
  let query = db.from("bgm_audit_trail_read").select("id", { count: "exact", head: true });
  if (from) query = query.gte("created_at", maltaDayUtcRange(from).start);
  if (to) query = query.lt("created_at", maltaDayUtcRange(to).end);
  if (category) query = query.eq("category", category);
  const result = await query;
  if (result.error) throw result.error;
  return result.count || 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const filters = readAuditFilters(request.nextUrl.searchParams);
    if ((filters.from && !isValidCalendarDate(filters.from))
      || (filters.to && !isValidCalendarDate(filters.to))
      || (filters.from && filters.to && filters.from > filters.to)) {
      return NextResponse.json({ error: "Choose a valid audit date range." }, { status: 400, headers: noStore });
    }

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1) || 1);
    const pageSize = Math.min(100, Math.max(20, Number(request.nextUrl.searchParams.get("pageSize") || 50) || 50));
    const start = (page - 1) * pageSize;
    const db = getSupabaseAdmin();

    let rowsQuery = db
      .from("bgm_audit_trail_read")
      .select(AUDIT_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    rowsQuery = applyAuditFilters(rowsQuery, filters);

    const today = todayMaltaDate();
    const selectedFrom = filters.from || undefined;
    const selectedTo = filters.to || undefined;

    const [rowsResult, usersResult, gymsResult, todayCount, weekCount, memberCount, financialCount, systemCount] = await Promise.all([
      rowsQuery,
      db.from("bgm_system_users").select("id,username,display_name,is_super_admin,active").order("display_name"),
      db.from("bgm_gyms").select("id,name,status").order("name"),
      countQuery(db, today, today),
      countQuery(db, weekStart(today), today),
      countQuery(db, selectedFrom, selectedTo, "member"),
      countQuery(db, selectedFrom, selectedTo, "financial"),
      countQuery(db, selectedFrom, selectedTo, "system"),
    ]);

    if (rowsResult.error) throw rowsResult.error;
    if (usersResult.error) throw usersResult.error;
    if (gymsResult.error) throw gymsResult.error;

    return NextResponse.json({
      rows: rowsResult.data || [],
      total: rowsResult.count || 0,
      page,
      pageSize,
      users: usersResult.data || [],
      gyms: gymsResult.data || [],
      summary: {
        today: todayCount,
        thisWeek: weekCount,
        memberChanges: memberCount,
        financialChanges: financialCount,
        systemChanges: systemCount,
      },
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load the audit trail." }, { status: 500, headers: noStore });
  }
}
