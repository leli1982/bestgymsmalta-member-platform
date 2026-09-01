import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { validateOrderNotificationSettings } from "@/lib/notificationSettingsCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

async function requireBootstrapAdminOrSuperAdmin(request: NextRequest) {
  if (isAdminRequest(request)) {
    return { context: null, error: null };
  }

  const context = await getSystemContext(request);
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
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
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_notification_settings")
      .select("orders_email, email_enabled, push_enabled, updated_at")
      .eq("id", "orders")
      .maybeSingle();

    if (result.error) throw result.error;

    const row = result.data || {
      orders_email: "info@bestgymsmalta.com",
      email_enabled: true,
      push_enabled: true,
      updated_at: null,
    };

    return NextResponse.json({
      settings: {
        ordersEmail: row.orders_email,
        emailEnabled: Boolean(row.email_enabled),
        pushEnabled: Boolean(row.push_enabled),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load notification settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBootstrapAdminOrSuperAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    let settings;

    try {
      settings = validateOrderNotificationSettings({
        ordersEmail: body.ordersEmail,
        emailEnabled: body.emailEnabled,
        pushEnabled: body.pushEnabled,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid settings." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const result = await supabase
      .from("bgm_notification_settings")
      .upsert(
        {
          id: "orders",
          orders_email: settings.ordersEmail,
          email_enabled: settings.emailEnabled,
          push_enabled: settings.pushEnabled,
          updated_by_system_user_id: auth.context?.systemUserId || null,
          updated_at: now,
        },
        { onConflict: "id" }
      )
      .select("orders_email, email_enabled, push_enabled, updated_at")
      .single();

    if (result.error) throw result.error;

    if (auth.context) {
      const auditResult = await supabase.from("bgm_audit_log").insert({
        system_user_id: auth.context.systemUserId,
        context_gym_id: auth.context.gymId,
        staff_name: null,
        action_key: "notification_settings.updated",
        entity_type: "notification_settings",
        entity_id: "orders",
        after_data: {
          ordersEmail: result.data.orders_email,
          emailEnabled: result.data.email_enabled,
          pushEnabled: result.data.push_enabled,
        },
      });
      if (auditResult.error) console.error(auditResult.error);
    }

    return NextResponse.json({
      settings: {
        ordersEmail: result.data.orders_email,
        emailEnabled: Boolean(result.data.email_enabled),
        pushEnabled: Boolean(result.data.push_enabled),
        updatedAt: result.data.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update notification settings." },
      { status: 500 }
    );
  }
}
