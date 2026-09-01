import { NextRequest, NextResponse } from "next/server";
import { ensurePushVapidConfig } from "@/lib/pushNotifications";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireSuperAdmin(request: NextRequest) {
  const context = await getSystemContext(request);
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "System login required." }, { status: 401 }),
    };
  }

  if (!context.isSuperAdmin) {
    return {
      context: null,
      error: NextResponse.json(
        { error: "Super Admin access is required." },
        { status: 403 }
      ),
    };
  }

  return { context, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const [settingsResult, subscriptionsResult] = await Promise.all([
      supabase
        .from("bgm_notification_settings")
        .select("push_enabled, vapid_public_key")
        .eq("id", "orders")
        .maybeSingle(),
      supabase
        .from("bgm_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("system_user_id", auth.context.systemUserId)
        .eq("active", true),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    return NextResponse.json({
      pushEnabled: Boolean(settingsResult.data?.push_enabled),
      configured: Boolean(settingsResult.data?.vapid_public_key),
      publicKey: settingsResult.data?.vapid_public_key || null,
      subscriptionCount: subscriptionsResult.count || 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load push settings." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

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
    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_push_subscriptions")
      .upsert(
        {
          system_user_id: auth.context.systemUserId,
          endpoint,
          p256dh,
          auth: authKey,
          device_label: deviceLabel || null,
          active: true,
          failure_count: 0,
          updated_at: now,
        },
        { onConflict: "endpoint" }
      )
      .select("id, device_label, active, created_at, updated_at")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({ subscription: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not configure push notifications." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json();
    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Push endpoint is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_push_subscriptions")
      .delete()
      .eq("system_user_id", auth.context.systemUserId)
      .eq("endpoint", endpoint);

    if (result.error) throw result.error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not remove push subscription." }, { status: 500 });
  }
}
