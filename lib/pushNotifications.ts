import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOrderPushPayload } from "@/lib/pushNotificationsCore";

export type StoredPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export async function ensurePushVapidConfig(): Promise<StoredPushConfig> {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bgm_notification_settings")
    .select("orders_email, vapid_public_key, vapid_private_key, vapid_subject")
    .eq("id", "orders")
    .maybeSingle();

  if (result.error) throw result.error;

  const current = result.data;
  if (
    current?.vapid_public_key &&
    current?.vapid_private_key &&
    current?.vapid_subject
  ) {
    return {
      publicKey: current.vapid_public_key,
      privateKey: current.vapid_private_key,
      subject: current.vapid_subject,
    };
  }

  const keys = webpush.generateVAPIDKeys();
  const subject = `mailto:${current?.orders_email || "info@bestgymsmalta.com"}`;
  const now = new Date().toISOString();

  const saveResult = await supabase
    .from("bgm_notification_settings")
    .upsert(
      {
        id: "orders",
        orders_email: current?.orders_email || "info@bestgymsmalta.com",
        email_enabled: true,
        push_enabled: true,
        vapid_public_key: keys.publicKey,
        vapid_private_key: keys.privateKey,
        vapid_subject: subject,
        updated_at: now,
      },
      { onConflict: "id" }
    );

  if (saveResult.error) throw saveResult.error;

  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject,
  };
}

export async function sendOperationalOrderPush(input: {
  orderType: "sundries" | "bar";
  orderId: string;
  gymName: string;
  staffName: string;
  itemCount: number;
}) {
  const supabase = getSupabaseAdmin();
  const settingsResult = await supabase
    .from("bgm_notification_settings")
    .select("push_enabled, vapid_public_key, vapid_private_key, vapid_subject")
    .eq("id", "orders")
    .maybeSingle();

  if (settingsResult.error) throw settingsResult.error;
  const settings = settingsResult.data;

  if (!settings?.push_enabled) {
    return { status: "disabled" as const, sent: 0, failed: 0, subscriptions: 0 };
  }

  if (
    !settings.vapid_public_key ||
    !settings.vapid_private_key ||
    !settings.vapid_subject
  ) {
    return {
      status: "not_configured" as const,
      sent: 0,
      failed: 0,
      subscriptions: 0,
    };
  }

  const subscriptionsResult = await supabase
    .from("bgm_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("active", true);

  if (subscriptionsResult.error) throw subscriptionsResult.error;
  const subscriptions = subscriptionsResult.data || [];

  if (!subscriptions.length) {
    return {
      status: "not_configured" as const,
      sent: 0,
      failed: 0,
      subscriptions: 0,
    };
  }

  webpush.setVapidDetails(
    settings.vapid_subject,
    settings.vapid_public_key,
    settings.vapid_private_key
  );

  const payload = JSON.stringify(buildOrderPushPayload(input));
  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );

      sent += 1;
      const now = new Date().toISOString();
      const updateResult = await supabase
        .from("bgm_push_subscriptions")
        .update({
          last_success_at: now,
          failure_count: 0,
          updated_at: now,
        })
        .eq("id", subscription.id);
      if (updateResult.error) console.error(updateResult.error);
    } catch (error) {
      failed += 1;
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode || 0)
          : 0;
      const now = new Date().toISOString();

      const update: Record<string, unknown> = {
        last_failure_at: now,
        failure_count: Number(subscription.failure_count || 0) + 1,
        updated_at: now,
      };

      if (statusCode === 404 || statusCode === 410) {
        update.active = false;
      }

      const updateResult = await supabase
        .from("bgm_push_subscriptions")
        .update(update)
        .eq("id", subscription.id);
      if (updateResult.error) console.error(updateResult.error);
      console.error("Operational order push failed:", error);
    }
  }

  return {
    status: sent > 0 ? ("sent" as const) : ("failed" as const),
    sent,
    failed,
    subscriptions: subscriptions.length,
  };
}
