import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const result = await getSupabaseAdmin().from("bgm_members")
      .select("id,member_number,full_name,membership_expiry,cancellation_effective_date,archived_at,archived_reason")
      .eq("status", "archived")
      .order("archived_at", { ascending: false })
      .limit(101);
    if (result.error) throw result.error;
    return NextResponse.json({
      members: (result.data || []).slice(0, 100).map(member => ({
        id: member.id, memberNumber: member.member_number, fullName: member.full_name,
        membershipExpiry: member.membership_expiry, cancellationEffectiveDate: member.cancellation_effective_date,
        archivedAt: member.archived_at, archivedReason: member.archived_reason,
      })),
      hasMore: (result.data || []).length > 100,
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load the Super Admin archive." },
      { status: 500, headers: noStore });
  }
}
