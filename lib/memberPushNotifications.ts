import webpush from "web-push";
import { ensurePushVapidConfig } from "@/lib/pushNotifications";
import { buildMembershipReminderPush, type MembershipReminderDays } from "@/lib/membershipReminderCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function sendMemberMembershipReminderPush(input: {
  memberId: string;
  expiryDate: string;
  daysBefore: MembershipReminderDays;
}) {
  const supabase = getSupabaseAdmin();
  const subscriptionsResult = await supabase
    .from("bgm_member_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("member_id", input.memberId)
    .eq("active", true);

  if (subscriptionsResult.error) throw subscriptionsResult.error;
  const subscriptions = subscriptionsResult.data || [];
  if (!subscriptions.length) {
    return { status: "not_available" as const, sent: 0, failed: 0, subscriptions: 0 };
  }

  const config = await ensurePushVapidConfig();
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payload = JSON.stringify(buildMembershipReminderPush(input));

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
      sent += 1;
      const now = new Date().toISOString();
      const updateResult = await supabase
        .from("bgm_member_push_subscriptions")
        .update({ last_success_at: now, failure_count: 0, updated_at: now })
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
      if (statusCode === 404 || statusCode === 410) update.active = false;
      const updateResult = await supabase
        .from("bgm_member_push_subscriptions")
        .update(update)
        .eq("id", subscription.id);
      if (updateResult.error) console.error(updateResult.error);
      console.error("Member membership reminder push failed:", error);
    }
  }

  return {
    status: sent > 0 ? ("sent" as const) : ("failed" as const),
    sent,
    failed,
    subscriptions: subscriptions.length,
  };
}
