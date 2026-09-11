import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const PHOTO_BUCKET = "bgm-member-photos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.photos.view");
    if (auth.error || !auth.context) return auth.error;

    const { memberId } = await params;
    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("id, official_photo_path")
      .eq("id", memberId)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;
    if (!memberResult.data) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    if (!memberResult.data.official_photo_path) {
      return NextResponse.json({ error: "No official photo has been captured." }, { status: 404 });
    }

    const signed = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(memberResult.data.official_photo_path, 60);
    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error || new Error("Could not sign official photo.");
    }

    return NextResponse.redirect(signed.data.signedUrl, 307);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load official member photo." }, { status: 500 });
  }
}
