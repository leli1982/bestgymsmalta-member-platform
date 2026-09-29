import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function createMemberNotification(input: {
  memberId: string;
  type?: string;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey?: string | null;
}) {
  const result = await getSupabaseAdmin()
    .from("bgm_member_notifications")
    .insert({
      member_id: input.memberId,
      notification_type: input.type || "general",
      title: input.title,
      body: input.body,
      href: input.href || null,
      dedupe_key: input.dedupeKey || null,
    });

  if (result.error) {
    if (input.dedupeKey && result.error.code === "23505") return;
    throw result.error;
  }
}
