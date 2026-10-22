import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireGymManager } from "@/lib/systemAuth";
import { isValidCalendarDate, maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const pageSize = 500;
const activePageSize = 1000;

const LEGACY_TO_GYM_ID: Record<string, string> = {
  "Tal-Qroqq": "bgm-talqroqq",
  Birkirkara: "bgm-birkirkara",
  Kirkop: "bgm-kirkop",
  Marsa: "bgm-marsa",
  Neptunes: "bgm-neptunes",
  Pembroke: "bgm-pembroke",
  Build: "bgm-build",
  Sliema: "bgm-sliema",
  "Birżebbuġa": "bgm-birzebbuga",
};

type MembershipKind = "new" | "renewal";
type StatsRow = {
  id: string;
  enrollment_gym_id: string;
  application_kind: MembershipKind;
  activated_at: string;
};

type ActiveMemberRow = {
  id: string;
  enrollment_gym_id: string | null;
  legacy_gym: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGymManager(request);
    if (auth.error || !auth.context) return auth.error;

    const assignedGymIds = auth.context.managedGymIds;
    if (assignedGymIds.length === 0) {
      return NextResponse.json({ error: "No gyms are assigned to this Gym Manager." }, { status: 403 });
    }

    const now = todayMaltaDate();
    const from = request.nextUrl.searchParams.get("from") || now.slice(0, 8) + "01";
    const to = request.nextUrl.searchParams.get("to") || now;
    const requestedGymId = String(request.nextUrl.searchParams.get("gymId") || "").trim();

    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      return NextResponse.json({ error: "Choose a valid Malta date range (start on or before end)." }, { status: 400 });
    }
    if (requestedGymId && !assignedGymIds.includes(requestedGymId)) {
      return NextResponse.json({ error: "That gym is not assigned to this Gym Manager." }, { status: 403 });
    }

    const selectedGymIds = requestedGymId ? [requestedGymId] : assignedGymIds;
    const start = maltaDayUtcRange(from).start;
    const end = maltaDayUtcRange(to).end;
    const supabase = getSupabaseAdmin();

    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id,name")
      .in("id", assignedGymIds)
      .order("name", { ascending: true });
    if (gymResult.error) throw gymResult.error;

    const gymNames = new Map((gymResult.data || []).map((gym) => [String(gym.id), String(gym.name || gym.id)]));
    const rows: StatsRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase
        .from("bgm_membership_applications")
        .select("id,enrollment_gym_id,application_kind,activated_at")
        .eq("status", "activated")
        .in("application_kind", ["new", "renewal"])
        .in("enrollment_gym_id", selectedGymIds)
        .gte("activated_at", start)
        .lt("activated_at", end)
        .order("activated_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      const batch = (result.data || []) as StatsRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }

    const byGym = selectedGymIds.map((gymId) => {
      const gymRows = rows.filter((row) => row.enrollment_gym_id === gymId);
      const newMemberships = gymRows.filter((row) => row.application_kind === "new").length;
      const renewals = gymRows.filter((row) => row.application_kind === "renewal").length;
      return {
        gymId,
        gymName: gymNames.get(gymId) || gymId,
        newMemberships,
        renewals,
        total: newMemberships + renewals,
      };
    });

    const activeCounts = new Map<string, number>(assignedGymIds.map((gymId) => [gymId, 0]));
    for (let offset = 0; ; offset += activePageSize) {
      const result = await supabase
        .from("bgm_members")
        .select("id,enrollment_gym_id,legacy_gym")
        .eq("status", "active")
        .is("archived_at", null)
        .or(`membership_expiry.is.null,membership_expiry.gte.${now}`)
        .or(`cancellation_effective_date.is.null,cancellation_effective_date.gt.${now}`)
        .range(offset, offset + activePageSize - 1);
      if (result.error) throw result.error;

      const batch = (result.data || []) as ActiveMemberRow[];
      for (const member of batch) {
        const resolvedGymId =
          member.enrollment_gym_id ||
          LEGACY_TO_GYM_ID[String(member.legacy_gym || "").trim()] ||
          null;
        if (!resolvedGymId || !assignedGymIds.includes(resolvedGymId)) continue;
        activeCounts.set(resolvedGymId, (activeCounts.get(resolvedGymId) || 0) + 1);
      }

      if (batch.length < activePageSize) break;
    }

    const activeMembershipsByGym = assignedGymIds.map((gymId) => ({
      gymId,
      gymName: gymNames.get(gymId) || gymId,
      activeMemberships: activeCounts.get(gymId) || 0,
    }));
    const totalActiveMemberships = activeMembershipsByGym.reduce(
      (sum, gym) => sum + gym.activeMemberships,
      0
    );

    const newMemberships = byGym.reduce((sum, gym) => sum + gym.newMemberships, 0);
    const renewals = byGym.reduce((sum, gym) => sum + gym.renewals, 0);

    return NextResponse.json({
      range: { from, to, gymId: requestedGymId || null },
      assignedGyms: assignedGymIds.map((gymId) => ({ id: gymId, name: gymNames.get(gymId) || gymId })),
      totals: {
        newMemberships,
        renewals,
        grandTotal: newMemberships + renewals,
      },
      byGym,
      activeMembershipsByGym,
      totalActiveMemberships,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load Gym Manager membership statistics:", error);
    return NextResponse.json({ error: "Could not load Gym Manager membership statistics." }, { status: 500 });
  }
}
