import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type GymRow = {
  id: string;
  name: string;
  logo?: string | null;
  status?: string | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

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

async function getActiveMember(memberId: string) {
  const supabase = getSupabaseAdmin();

  const memberResult = await supabase
    .from("bgm_members")
    .select("id, full_name, member_number, email, status, membership_expiry")
    .eq("id", memberId)
    .maybeSingle();

  if (memberResult.error) throw memberResult.error;

  const member = memberResult.data;

  if (!member) {
    return {
      ok: false,
      error: "Member account not found.",
      member: null,
    };
  }

  if (member.status !== "active") {
    return {
      ok: false,
      error: "This membership is inactive. Please renew at reception.",
      member,
    };
  }

  if (member.membership_expiry && member.membership_expiry < todayString()) {
    return {
      ok: false,
      error: "This membership has expired. Please renew at reception.",
      member,
    };
  }

  return {
    ok: true,
    error: "",
    member,
  };
}

async function refreshMemberStats(memberId: string) {
  const supabase = getSupabaseAdmin();

  const checkinsResult = await supabase
    .from("bgm_member_checkins")
    .select("gym_id, checkin_at")
    .eq("member_id", memberId)
    .order("checkin_at", { ascending: false });

  if (checkinsResult.error) throw checkinsResult.error;

  const checkins = checkinsResult.data || [];
  const passportStamps = new Set(checkins.map((item) => item.gym_id)).size;

  const payload = {
    member_id: memberId,
    workouts_completed: checkins.length,
    current_streak: 0,
    passport_stamps: passportStamps,
    last_checkin_at: checkins[0]?.checkin_at || null,
    updated_at: new Date().toISOString(),
  };

  const existingResult = await supabase
    .from("bgm_member_stats")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;

  if (existingResult.data?.id) {
    const updateResult = await supabase
      .from("bgm_member_stats")
      .update(payload)
      .eq("id", existingResult.data.id);

    if (updateResult.error) throw updateResult.error;
  } else {
    const insertResult = await supabase
      .from("bgm_member_stats")
      .insert(payload);

    if (insertResult.error) throw insertResult.error;
  }

  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const memberId = request.nextUrl.searchParams.get("memberId") || "";

    if (!memberId) {
      return NextResponse.json({
        memberId: "",
        visitedGymIds: [],
        checkins: [],
        recentCheckins: [],
        stats: {
          totalCheckins: 0,
          passportStamps: 0,
          latestCheckinAt: null,
        },
      });
    }

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
      stats: {
        totalCheckins: checkins.length,
        passportStamps: visitedGymIds.length,
        latestCheckinAt: checkins[0]?.checkinAt || null,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        visitedGymIds: [],
        checkins: [],
        recentCheckins: [],
        stats: {
          totalCheckins: 0,
          passportStamps: 0,
          latestCheckinAt: null,
        },
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

    const memberId = String(body.memberId || "").trim();
    const gymId = String(body.gymId || "").trim();

    if (!memberId) {
      return NextResponse.json(
        { error: "Please log in before checking in." },
        { status: 401 }
      );
    }

    if (!gymId) {
      return NextResponse.json({ error: "Missing gym ID." }, { status: 400 });
    }

    const activeMember = await getActiveMember(memberId);

    if (!activeMember.ok) {
      return NextResponse.json(
        { error: activeMember.error },
        { status: 403 }
      );
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
      await refreshMemberStats(memberId);

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

    const stats = await refreshMemberStats(memberId);

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: `Checked in at ${gymResult.data.name}.`,
      gym: gymResult.data,
      checkin: insertResult.data,
      stats,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save check-in." },
      { status: 500 }
    );
  }
}
