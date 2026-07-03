import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest) {
  const expectedPin = process.env.BGM_ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");

  return Boolean(expectedPin && suppliedPin && suppliedPin === expectedPin);
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const checkinsResult = await supabase
      .from("bgm_member_checkins")
      .select("*")
      .order("checkin_at", { ascending: false })
      .limit(50);

    if (checkinsResult.error) throw checkinsResult.error;

    const gymsResult = await supabase.from("bgm_gyms").select("id, name, logo");

    if (gymsResult.error) throw gymsResult.error;

    const gymMap = new Map(
      (gymsResult.data || []).map((gym) => [gym.id, gym])
    );

    const checkins = (checkinsResult.data || []).map((checkin) => {
      const gym = gymMap.get(checkin.gym_id);

      return {
        id: checkin.id,
        memberId: checkin.member_id,
        gymId: checkin.gym_id,
        gymName: gym?.name || checkin.gym_id,
        gymLogo: gym?.logo || "",
        checkinAt: checkin.checkin_at,
        source: checkin.source,
      };
    });

    return NextResponse.json({ checkins });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not load check-ins." },
      { status: 500 }
    );
  }
}
