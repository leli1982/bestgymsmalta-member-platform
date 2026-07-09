import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

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

    const limit = Math.min(
      500,
      Math.max(20, Number(request.nextUrl.searchParams.get("limit") || 200))
    );

    const gymId = request.nextUrl.searchParams.get("gymId") || "";

    let query = supabase
      .from("bgm_member_checkins")
      .select("id, member_id, gym_id, checkin_at, source, created_at")
      .order("checkin_at", { ascending: false })
      .limit(limit);

    if (gymId) {
      query = query.eq("gym_id", gymId);
    }

    const checkinsResult = await query;

    if (checkinsResult.error) throw checkinsResult.error;

    const checkins = checkinsResult.data || [];

    const memberIds = Array.from(
      new Set(
        checkins
          .map((item) => String(item.member_id || ""))
          .filter((value) => value && isUuid(value))
      )
    );

    const gymIds = Array.from(
      new Set(checkins.map((item) => String(item.gym_id || "")).filter(Boolean))
    );

    const membersResult = memberIds.length
      ? await supabase
          .from("bgm_members")
          .select("id, member_number, full_name, email")
          .in("id", memberIds)
      : { data: [], error: null };

    if (membersResult.error) throw membersResult.error;

    const gymsResult = gymIds.length
      ? await supabase
          .from("bgm_gyms")
          .select("id, name, short_name, city")
          .in("id", gymIds)
      : { data: [], error: null };

    if (gymsResult.error) throw gymsResult.error;

    const membersById = new Map(
      (membersResult.data || []).map((member) => [String(member.id), member])
    );

    const gymsById = new Map(
      (gymsResult.data || []).map((gym) => [String(gym.id), gym])
    );

    const mapped = checkins.map((checkin) => {
      const member = membersById.get(String(checkin.member_id || ""));
      const gym = gymsById.get(String(checkin.gym_id || ""));

      return {
        id: checkin.id,
        memberId: checkin.member_id,
        memberName: member?.full_name || "Unknown member",
        memberNumber: member?.member_number || "",
        memberEmail: member?.email || "",
        gymId: checkin.gym_id,
        gymName: gym?.short_name || gym?.name || checkin.gym_id || "Unknown gym",
        gymCity: gym?.city || "",
        checkinAt: checkin.checkin_at || checkin.created_at,
        source: checkin.source || "qr",
      };
    });

    return NextResponse.json({
      checkins: mapped,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not load check-ins." },
      { status: 500 }
    );
  }
}
