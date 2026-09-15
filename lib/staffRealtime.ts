import "server-only";
import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSystemSessionSecret } from "@/lib/systemAuthCore";

const EVENT_NAME = "membership-queue-changed";

function staffRealtimeSecret() {
  return resolveSystemSessionSecret({
    BGM_SYSTEM_SESSION_SECRET: process.env.BGM_SYSTEM_SESSION_SECRET,
    BGM_ADMIN_SESSION_SECRET: process.env.BGM_ADMIN_SESSION_SECRET,
    BGM_ADMIN_PIN: process.env.BGM_ADMIN_PIN,
  });
}

export function staffMembershipTopic(gymId: string) {
  const normalizedGymId = String(gymId || "").trim();
  const secret = staffRealtimeSecret();
  if (!normalizedGymId || !secret) {
    throw new Error("Staff Realtime topic configuration is unavailable.");
  }

  const digest = createHmac("sha256", secret)
    .update(`staff-membership-queue:${normalizedGymId}`)
    .digest("hex");

  return `bgm-staff-memberships:${digest}`;
}

export async function broadcastStaffMembershipRefresh(gymId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const channel = supabase.channel(staffMembershipTopic(gymId));
    try {
      const result = await channel.httpSend(EVENT_NAME, { refresh: true });
      if (result !== "ok") {
        console.error("Staff membership refresh broadcast was not acknowledged.", result);
      }
    } finally {
      await supabase.removeChannel(channel);
    }
  } catch (error) {
    // Realtime is only a refresh accelerator. The persisted database state remains authoritative.
    console.error("Could not broadcast staff membership refresh.", error);
  }
}
