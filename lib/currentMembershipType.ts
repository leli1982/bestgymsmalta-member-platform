import "server-only";

import { normalizeMembershipThemeType, type MembershipThemeType } from "./membershipTheme";

export async function loadCurrentMembershipType(
  supabase: any,
  memberId: string,
): Promise<MembershipThemeType | null> {
  const links = await supabase
    .from("bgm_membership_members")
    .select("membership_id")
    .eq("member_id", memberId);

  if (links.error) throw links.error;
  const membershipIds = Array.from(new Set((links.data || []).map((row: any) => row.membership_id).filter(Boolean)));
  if (!membershipIds.length) return null;

  const memberships = await supabase
    .from("bgm_memberships")
    .select("id,membership_type,status,start_date,expiry_date,updated_at")
    .in("id", membershipIds)
    .eq("status", "active")
    .order("expiry_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (memberships.error) throw memberships.error;
  return normalizeMembershipThemeType(memberships.data?.[0]?.membership_type);
}
