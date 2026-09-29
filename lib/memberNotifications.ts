import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function createMemberNotification(input: {
  memberId: string;
  type?: string;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey?: string | null;
}) {
  const payload = {
    member_id: input.memberId,
    notification_type: input.type || "general",
    title: input.title,
    body: input.body,
    href: input.href || null,
    dedupe_key: input.dedupeKey || null,
  };

  const query = getSupabaseAdmin().from("bgm_member_notifications");
  const result = input.dedupeKey
    ? await query.upsert(payload, { onConflict: "member_id,dedupe_key", ignoreDuplicates: true })
    : await query.insert(payload);

  if (result.error) throw result.error;
}
