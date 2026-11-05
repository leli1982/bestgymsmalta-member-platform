import "server-only";
import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSystemSessionSecret } from "@/lib/systemAuthCore";

const EVENT_NAME = "urgent-staff-alert-changed";

export function urgentStaffAlertTopic(gymId: string) {
  const secret = resolveSystemSessionSecret({
    BGM_SYSTEM_SESSION_SECRET: process.env.BGM_SYSTEM_SESSION_SECRET,
    BGM_ADMIN_SESSION_SECRET: process.env.BGM_ADMIN_SESSION_SECRET,
    BGM_ADMIN_PIN: process.env.BGM_ADMIN_PIN,
  });
  if (!gymId || !secret) throw new Error("Staff alert Realtime is unavailable.");
  const digest = createHmac("sha256", secret)
    .update("urgent-staff-alert:" + gymId).digest("hex");
  return "bgm-urgent-staff-alerts:" + digest;
}

/** Broadcast contains NO message content or personal information. Database is authoritative. */
export async function broadcastUrgentStaffAlertRefresh(gymId: string) {
  try {
    const db = getSupabaseAdmin();
    const channel = db.channel(urgentStaffAlertTopic(gymId));
    try {
      const result = await channel.httpSend(EVENT_NAME, { refresh: true });
      if (!result.success) console.warn("Urgent alert refresh signal not confirmed.");
    } finally {
      await db.removeChannel(channel);
    }
  } catch (error) {
    console.warn("Urgent alert Realtime unavailable; polling remains active.", error);
  }
}
