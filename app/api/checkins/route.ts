import { NextRequest, NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordCanonicalCheckin } from "@/lib/checkinService";

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

    const authError = requireMemberSession(request, memberId);
    if (authError) return authError;

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

    const authError = requireMemberSession(request, memberId);
    if (authError) return authError;

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

    const checkin = await recordCanonicalCheckin({
      memberId,
      gymId,
      source: "qr",
    });

    if (checkin.duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You have already checked in here recently.",
        gym: gymResult.data,
      });
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: `Checked in at ${gymResult.data.name}.`,
      gym: gymResult.data,
      checkin: checkin.checkin,
      stats: checkin.stats,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not save check-in." },
      { status: 500 }
    );
  }
}
