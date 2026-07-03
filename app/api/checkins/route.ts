import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const DEFAULT_MEMBER_ID = "demo-member";

type GymRow = {
  id: string;
  name: string;
  logo?: string | null;
  status?: string | null;
};

async function getGymMap() {
  const supabase = getSupabaseAdmin();

  const gymsResult = await supabase
    .from("bgm_gyms")
    .select("id, name, logo, status");

  if (gymsResult.error) throw gymsResult.error;

  const gymMap = new Map<string, GymRow>();

  for (const gym of gymsResult.data || []) {
    gymMap.set(gym.id, gym);
  }

  return gymMap;
}

export async function GET(request: NextRequest) {
  try {
    const memberId =
      request.nextUrl.searchParams.get("memberId") || DEFAULT_MEMBER_ID;

    const supabase = getSupabaseAdmin();

    const checkinsResult = await supabase
      .from("bgm_member_checkins")
      .select("*")
      .eq("member_id", memberId)
      .order("checkin_at", { ascending: false })
      .limit(100);

    if (checkinsResult.error) throw checkinsResult.error;

    const gymMap = await getGymMap();

    const checkins = (checkinsResult.data || []).map((checkin) => {
      const gym = gymMap.get(checkin.gym_id);

      return {
        id: checkin.id,
        memberId: checkin.member_id,
        gymId: checkin.gym_id,
        gymName: gym?.name || checkin.gym_id,
        gymLogo: gym?.logo || "",
        gymStatus: gym?.status || "",
        checkinAt: checkin.checkin_at,
        source: checkin.source,
      };
    });

    const visitedGymIds = Array.from(
      new Set(checkins.map((checkin) => checkin.gymId))
    );

    return NextResponse.json({
      memberId,
      visitedGymIds,
      checkins,
      recentCheckins: checkins.slice(0, 5),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        visitedGymIds: [],
        checkins: [],
        recentCheckins: [],
        error: "Could not load check-ins.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const memberId = String(body.memberId || DEFAULT_MEMBER_ID).trim();
    const gymId = String(body.gymId || "").trim();

    if (!gymId) {
      return NextResponse.json({ error: "Missing gym ID." }, { status: 400 });
    }

    const gymResult = await supabase
      .from("bgm_gyms")
      .select("id, name, logo, status")
      .eq("id", gymId)
      .single();

    if (gymResult.error || !gymResult.data) {
      return NextResponse.json({ error: "Gym not found." }, { status: 404 });
    }

    if (gymResult.data.status !== "active") {
      return NextResponse.json(
        { error: "This gym is not active yet." },
        { status: 400 }
      );
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const recentResult = await supabase
      .from("bgm_member_checkins")
      .select("id, checkin_at")
      .eq("member_id", memberId)
      .eq("gym_id", gymId)
      .gte("checkin_at", twoHoursAgo)
      .limit(1);

    if (recentResult.error) throw recentResult.error;

    if ((recentResult.data || []).length > 0) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You have already checked in here recently.",
        gym: gymResult.data,
      });
    }

    const insertResult = await supabase
      .from("bgm_member_checkins")
      .insert({
        member_id: memberId,
        gym_id: gymId,
        source: "qr",
      })
      .select()
      .single();

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: `Checked in at ${gymResult.data.name}.`,
      gym: gymResult.data,
      checkin: insertResult.data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save check-in." },
      { status: 500 }
    );
  }
}
