import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { MEMBER_PROFILE_COLUMNS, publicMemberProfile } from "@/lib/memberPublicProfile";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const session = getMemberRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: "Please sign in to your member account." }, { status: 401, headers });
    }

    const result = await getSupabaseAdmin()
      .from("bgm_members")
      .select(MEMBER_PROFILE_COLUMNS)
      .eq("id", session.memberId)
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json({ error: "Member account not found. Please sign in again." }, { status: 401, headers });
    }

    return NextResponse.json({ member: publicMemberProfile(result.data) }, { headers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not check your session. Please try again." }, { status: 500, headers });
  }
}
