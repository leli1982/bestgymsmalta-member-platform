import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireMember(request: NextRequest) {
  const session = getMemberRequestSession(request);
  if (!session) return null;
  return session.memberId;
}

export async function GET(request: NextRequest) {
  try {
    const memberId = await requireMember(request);
    if (!memberId) return NextResponse.json({ error: "Member session required." }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_member_notifications")
      .select("id,notification_type,title,body,href,read_at,created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw result.error;

    const notifications = result.data || [];
    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((item) => !item.read_at).length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const memberId = await requireMember(request);
    if (!memberId) return NextResponse.json({ error: "Member session required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.action === "read_all") {
      const result = await supabase
        .from("bgm_member_notifications")
        .update({ read_at: now })
        .eq("member_id", memberId)
        .is("read_at", null);
      if (result.error) throw result.error;
      return NextResponse.json({ success: true });
    }

    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Notification id is required." }, { status: 400 });

    const result = await supabase
      .from("bgm_member_notifications")
      .update({ read_at: now })
      .eq("member_id", memberId)
      .eq("id", id);
    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update notification." }, { status: 500 });
  }
}
