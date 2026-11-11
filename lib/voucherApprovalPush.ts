import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// The approval inbox is the durable notification. Push is best-effort and
// targets only active Super Admin accounts with existing enrolled devices.
export async function sendVoucherApprovalPush(input: {
  requestId: string;
  voucherCode: string;
  gymName: string;
}) {
  const db = getSupabaseAdmin();
  const settingsResult = await db.from("bgm_notification_settings")
    .select("push_enabled,vapid_public_key,vapid_private_key,vapid_subject")
    .eq("id","orders").maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  const config = settingsResult.data;
  if (!config?.push_enabled || !config.vapid_public_key ||
      !config.vapid_private_key || !config.vapid_subject) return;

  const subsResult = await db.from("bgm_push_subscriptions")
    .select("id,system_user_id,endpoint,p256dh,auth,failure_count")
    .eq("active",true);
  if (subsResult.error) throw subsResult.error;
  const subscriptions = subsResult.data || [];
  const userIds = Array.from(new Set(subscriptions.map(s => s.system_user_id).filter(Boolean)));
  if (!userIds.length) return;

  const adminsResult = await db.from("bgm_system_users")
    .select("id,is_super_admin,role").in("id",userIds).eq("active",true);
  if (adminsResult.error) throw adminsResult.error;
  const adminIds = new Set((adminsResult.data || [])
    .filter(user => user.is_super_admin || user.role === "super_admin").map(user => user.id));
  webpush.setVapidDetails(config.vapid_subject,config.vapid_public_key,config.vapid_private_key);
  const payload = JSON.stringify({
    title: "Voucher approval required",
    body: `${input.gymName} · ${input.voucherCode}`,
    url: "/staff/admin/voucher-approvals",
    tag: `bgm-voucher-approval-${input.requestId}`,
  });

  for (const subscription of subscriptions.filter(s => adminIds.has(s.system_user_id))) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },payload);
      await db.from("bgm_push_subscriptions")
        .update({ last_success_at: new Date().toISOString(),failure_count: 0,updated_at:new Date().toISOString() })
        .eq("id",subscription.id);
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode || 0) : 0;
      await db.from("bgm_push_subscriptions").update({
        failure_count: Number(subscription.failure_count || 0) + 1,
        last_failure_at: new Date().toISOString(),
        updated_at:new Date().toISOString(),
        ...(statusCode === 404 || statusCode === 410 ? { active:false } : {}),
      }).eq("id",subscription.id);
      console.error("Voucher approval push failed.",error);
    }
  }
}
