import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import { summariseNewMemberships, type ActivatedMembershipRow } from "@/lib/membershipStatsCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const pageSize = 500;
const gymPageSize = 500;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const now = todayMaltaDate();
    const from = request.nextUrl.searchParams.get("from") || now.slice(0, 8) + "01";
    const to = request.nextUrl.searchParams.get("to") || now;
    const gymId = String(request.nextUrl.searchParams.get("gymId") || "").trim();
    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json({ error: "Choose a valid Malta date range (start on or before end)." }, { status: 400 });
    }
    if (gymId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gymId)) {
      return NextResponse.json({ error: "Invalid gym selection." }, { status: 400 });
    }

    // Use Malta midnight boundaries (including DST switch days) so a late
    // evening activation is assigned to the right local business date.
    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;
    const supabase = getSupabaseAdmin();
    const gymNames: Record<string, string> = {};
    for (let offset = 0; ; offset += gymPageSize) {
      const result = await supabase.from("bgm_gyms")
        .select("id,name").order("id", { ascending: true })
        .range(offset, offset + gymPageSize - 1);
      if (result.error) throw result.error;
      const gyms = result.data || [];
      for (const gym of gyms) gymNames[gym.id] = gym.name || gym.id;
      if (gyms.length < gymPageSize) break;
    }
    if (gymId && !Object.prototype.hasOwnProperty.call(gymNames, gymId)) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    const applications: ActivatedMembershipRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = supabase.from("bgm_membership_applications")
        .select("id,enrollment_gym_id,membership_type,activated_at")
        .eq("application_kind", "new")
        .eq("status", "activated")
        .gte("activated_at", start)
        .lt("activated_at", end)
        .order("activated_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (gymId) query = query.eq("enrollment_gym_id", gymId);
      const result = await query;
      if (result.error) throw result.error;
      const batch = (result.data || []) as ActivatedMembershipRow[];
      applications.push(...batch);
      if (batch.length < pageSize) break;
    }
    return NextResponse.json({
      range: { from, to, gymId, gymName: gymId ? gymNames[gymId] : "All gyms" },
      ...summariseNewMemberships(applications, gymNames),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load new membership statistics:", error);
    return NextResponse.json({ error: "Could not load new membership statistics." }, { status: 500 });
  }
}
