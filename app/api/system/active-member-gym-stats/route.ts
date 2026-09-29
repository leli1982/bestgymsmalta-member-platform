import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  const auth = await requireSystemPermission(request, "members.view");
  if (auth.error || !auth.context) return auth.error;
  if (!auth.context.isSuperAdmin) {
    return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  }

  try {
    const db = getSupabaseAdmin();
    const today = todayMaltaDate();

    const gymsResult = await db
      .from("bgm_gyms")
      .select("id, name, status")
      .order("name", { ascending: true });

    if (gymsResult.error) throw gymsResult.error;

    const counts = new Map<string, number>();
    let unassigned = 0;
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const result = await db
        .from("bgm_members")
        .select("id, enrollment_gym_id, legacy_gym")
        .eq("status", "active")
        .is("archived_at", null)
        .or(`membership_expiry.is.null,membership_expiry.gte.${today}`)
        .or(`cancellation_effective_date.is.null,cancellation_effective_date.gt.${today}`)
        .range(offset, offset + pageSize - 1);

      if (result.error) throw result.error;

      const rows = result.data || [];
      for (const member of rows) {
        const gymId =
          member.enrollment_gym_id ||
          LEGACY_TO_GYM_ID[String(member.legacy_gym || "").trim()] ||
          null;

        if (!gymId) {
          unassigned += 1;
          continue;
        }
        counts.set(gymId, (counts.get(gymId) || 0) + 1);
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    const gyms = (gymsResult.data || []).map((gym) => ({
      gymId: gym.id,
      gymName: gym.name,
      gymStatus: gym.status,
      activeMembers: counts.get(gym.id) || 0,
    }));

    return NextResponse.json({
      totalActiveMembers: gyms.reduce((sum, gym) => sum + gym.activeMembers, 0) + unassigned,
      assignedActiveMembers: gyms.reduce((sum, gym) => sum + gym.activeMembers, 0),
      unassignedActiveMembers: unassigned,
      gyms,
      definition:
        "Active members are members whose account is active, not archived, not effectively cancelled, and whose membership has not expired. Current enrollment gym is used first; legacy gym is used only when current enrollment gym is missing.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load active member gym statistics." },
      { status: 500 }
    );
  }
}
