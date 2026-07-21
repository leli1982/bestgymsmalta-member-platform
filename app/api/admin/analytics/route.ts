import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function safeCount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  configure?: (query: any) => any
) {
  try {
    let query: any = supabase
      .from(table)
      .select("id", { count: "exact", head: true });

    if (configure) {
      query = configure(query);
    }

    const result = await query;

    if (result.error) {
      console.warn(`Analytics count failed for ${table}:`, result.error.message);
      return null;
    }

    return result.count ?? 0;
  } catch (error) {
    console.warn(`Analytics count failed for ${table}:`, error);
    return null;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: NextRequest) {
  try {
    const adminError = requireAdmin(request);
    if (adminError) return adminError;

    const supabase = getSupabaseAdmin();

    const todayStart = startOfToday();
    const tomorrowStart = addDays(todayStart, 1);
    const weekStart = addDays(todayStart, -6);
    const monthStart = addDays(todayStart, -30);

    const [
      activeMembers,
      totalMembers,
      activeGyms,
      checkinsToday,
      checkinsThisWeek,
      strengthLogs,
      progressPhotosA,
    ] = await Promise.all([
      safeCount(supabase, "bgm_members", (query) => query.eq("status", "active")),
      safeCount(supabase, "bgm_members"),
      safeCount(supabase, "bgm_gyms", (query) => query.eq("status", "active")),
      safeCount(supabase, "bgm_member_checkins", (query) =>
        query
          .gte("checkin_at", todayStart.toISOString())
          .lt("checkin_at", tomorrowStart.toISOString())
      ),
      safeCount(supabase, "bgm_member_checkins", (query) =>
        query.gte("checkin_at", weekStart.toISOString())
      ),
      safeCount(supabase, "bgm_strength_progress"),
      safeCount(supabase, "bgm_member_progress_photos"),
    ]);

    const progressPhotos =
      progressPhotosA ??
      (await safeCount(supabase, "bgm_progress_photos")) ??
      0;

    const checkinsResult = await supabase
      .from("bgm_member_checkins")
      .select("gym_id")
      .gte("checkin_at", monthStart.toISOString())
      .limit(10000);

    if (checkinsResult.error) throw checkinsResult.error;

    const gymCounts = new Map<string, number>();

    for (const item of checkinsResult.data || []) {
      const gymId = String(item.gym_id || "");
      if (!gymId) continue;

      gymCounts.set(gymId, (gymCounts.get(gymId) || 0) + 1);
    }

    const topGymIds = Array.from(gymCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([gymId]) => gymId);

    const gymsResult = topGymIds.length
      ? await supabase
          .from("bgm_gyms")
          .select("id, name, short_name, city")
          .in("id", topGymIds)
      : { data: [], error: null };

    if (gymsResult.error) throw gymsResult.error;

    const gymsById = new Map(
      (gymsResult.data || []).map((gym) => [String(gym.id), gym])
    );

    const mostVisitedGyms = Array.from(gymCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([gymId, count]) => {
        const gym = gymsById.get(gymId);

        return {
          gymId,
          gymName: gym?.short_name || gym?.name || gymId,
          gymCity: gym?.city || "",
          count,
        };
      });

    const latestCheckinsResult = await supabase
      .from("bgm_member_checkins")
      .select("id, member_id, gym_id, checkin_at, source, created_at")
      .order("checkin_at", { ascending: false })
      .limit(8);

    if (latestCheckinsResult.error) throw latestCheckinsResult.error;

    const latestCheckinsRaw = latestCheckinsResult.data || [];

    const memberIds = Array.from(
      new Set(
        latestCheckinsRaw
          .map((item) => String(item.member_id || ""))
          .filter((value) => value && isUuid(value))
      )
    );

    const latestGymIds = Array.from(
      new Set(
        latestCheckinsRaw
          .map((item) => String(item.gym_id || ""))
          .filter(Boolean)
      )
    );

    const membersResult = memberIds.length
      ? await supabase
          .from("bgm_members")
          .select("id, member_number, full_name, email")
          .in("id", memberIds)
      : { data: [], error: null };

    if (membersResult.error) throw membersResult.error;

    const latestGymsResult = latestGymIds.length
      ? await supabase
          .from("bgm_gyms")
          .select("id, name, short_name, city")
          .in("id", latestGymIds)
      : { data: [], error: null };

    if (latestGymsResult.error) throw latestGymsResult.error;

    const membersById = new Map(
      (membersResult.data || []).map((member) => [String(member.id), member])
    );

    const latestGymsById = new Map(
      (latestGymsResult.data || []).map((gym) => [String(gym.id), gym])
    );

    const latestCheckins = latestCheckinsRaw.map((checkin) => {
      const member = membersById.get(String(checkin.member_id || ""));
      const gym = latestGymsById.get(String(checkin.gym_id || ""));

      return {
        id: checkin.id,
        memberName: member?.full_name || "Unknown member",
        memberNumber: member?.member_number || "",
        gymName: gym?.short_name || gym?.name || checkin.gym_id || "Unknown gym",
        checkinAt: checkin.checkin_at || checkin.created_at,
        source: checkin.source || "qr",
      };
    });

    return NextResponse.json({
      overview: {
        activeMembers: activeMembers ?? 0,
        totalMembers: totalMembers ?? 0,
        activeGyms: activeGyms ?? 0,
        checkinsToday: checkinsToday ?? 0,
        checkinsThisWeek: checkinsThisWeek ?? 0,
        strengthLogs: strengthLogs ?? 0,
        progressPhotos,
      },
      mostVisitedGyms,
      latestCheckins,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not load analytics." },
      { status: 500 }
    );
  }
}
