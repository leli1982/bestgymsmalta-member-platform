import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { ensurePushVapidConfig } from "@/lib/pushNotifications";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAppMember(request: NextRequest) {
  const session = getMemberRequestSession(request);
  if (!session) {
    return {
      memberId: null,
      error: NextResponse.json({ error: "Member session required." }, { status: 401 }),
    };
  }

  const result = await getSupabaseAdmin()
    .from("bgm_members")
    .select("id,app_enrolled")
    .eq("id", session.memberId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || result.data.app_enrolled !== true) {
    return {
      memberId: null,
      error: NextResponse.json({ error: "Activate the member app before enabling notifications." }, { status: 403 }),
    };
  }

  return { memberId: session.memberId, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAppMember(request);
    if (auth.error || !auth.memberId) return auth.error;

    const supabase = getSupabaseAdmin();
    const [settingsResult, subscriptionResult] = await Promise.all([
      supabase
        .from("bgm_notification_settings")
        .select("vapid_public_key")
        .eq("id", "orders")
        .maybeSingle(),
      supabase
        .from("bgm_member_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("member_id", auth.memberId)
        .eq("active", true),
    ]);
    if (settingsResult.error) throw settingsResult.error;
    if (subscriptionResult.error) throw subscriptionResult.error;

    return NextResponse.json({
      configured: Boolean(settingsResult.data?.vapid_public_key),
      publicKey: settingsResult.data?.vapid_public_key || null,
      subscriptionCount: subscriptionResult.count || 0,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load member notification settings." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAppMember(request);
    if (auth.error || !auth.memberId) return auth.error;

    const body = await request.json();
    const action = String(body.action || "").trim().toLowerCase();

    if (action === "initialize") {
      const config = await ensurePushVapidConfig();
      return NextResponse.json({ configured: true, publicKey: config.publicKey });
    }

    if (action !== "subscribe") {
      return NextResponse.json({ error: "Invalid push action." }, { status: 400 });
    }

    const endpoint = String(body.subscription?.endpoint || "").trim();
    const p256dh = String(body.subscription?.keys?.p256dh || "").trim();
    const authKey = String(body.subscription?.keys?.auth || "").trim();
    const deviceLabel = String(body.deviceLabel || "").trim().slice(0, 120);

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    await ensurePushVapidConfig();
    const now = new Date().toISOString();
    const result = await getSupabaseAdmin()
      .from("bgm_member_push_subscriptions")
      .upsert({
        member_id: auth.memberId,
        endpoint,
        p256dh,
        auth: authKey,
        device_label: deviceLabel || null,
        active: true,
        failure_count: 0,
        updated_at: now,
      }, { onConflict: "endpoint" })
      .select("id,device_label,active,created_at,updated_at")
      .single();
    if (result.error) throw result.error;

    return NextResponse.json({ subscription: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not configure member notifications." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAppMember(request);
    if (auth.error || !auth.memberId) return auth.error;

    const body = await request.json();
    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Push endpoint is required." }, { status: 400 });
    }

    const result = await getSupabaseAdmin()
      .from("bgm_member_push_subscriptions")
      .delete()
      .eq("member_id", auth.memberId)
      .eq("endpoint", endpoint);
    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not remove member notification subscription." }, { status: 500 });
  }
}
