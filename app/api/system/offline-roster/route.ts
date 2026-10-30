import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  hashOfflineRoster,
  toOfflineRosterMember,
} from "@/lib/offlineRosterCore";

export const dynamic = "force-dynamic";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "offline_roster.view");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const [memberResult, modernCardsResult, legacyCardsResult] = await Promise.all([
      supabase
        .from("bgm_members")
        .select("id, member_number, full_name")
        .eq("status", "active")
        .or(`membership_expiry.is.null,membership_expiry.gte.${todayString()}`)
        .order("member_number", { ascending: true }),
      supabase
        .from("bgm_member_card_credentials")
        .select("member_id, barcode_value")
        .eq("status", "active"),
      supabase
        .from("bgm_legacy_card_claims")
        .select("member_id, scan3")
        .eq("assignment_status", "active"),
    ]);

    if (memberResult.error) throw memberResult.error;
    if (modernCardsResult.error) throw modernCardsResult.error;
    if (legacyCardsResult.error) throw legacyCardsResult.error;

    const cardsByMember = new Map<string, string[]>();
    const addCard = (memberId: unknown, cardValue: unknown) => {
      const id = String(memberId || "").trim();
      const card = String(cardValue || "").trim();
      if (!id || !card) return;
      const current = cardsByMember.get(id) || [];
      if (!current.includes(card)) current.push(card);
      cardsByMember.set(id, current);
    };

    for (const card of modernCardsResult.data || []) {
      addCard(card.member_id, card.barcode_value);
    }
    for (const claim of legacyCardsResult.data || []) {
      addCard(claim.member_id, claim.scan3);
    }

    const members = (memberResult.data || [])
      .map((row) =>
        toOfflineRosterMember({
          member_number: row.member_number,
          full_name: row.full_name,
          card_numbers: cardsByMember.get(String(row.id)) || [],
        })
      )
      .filter((member) => member.memberNumber && member.fullName);
    const rosterHash = hashOfflineRoster(members);
    const generatedAt = new Date().toISOString();
    const deviceId = String(request.nextUrl.searchParams.get("deviceId") || "").trim();

    if (deviceId && auth.context.gymId) {
      const syncResult = await supabase.from("bgm_offline_roster_syncs").upsert(
        {
          system_user_id: auth.context.systemUserId,
          gym_id: auth.context.gymId,
          device_id: deviceId,
          last_synced_at: generatedAt,
          member_count: members.length,
          roster_hash: rosterHash,
          updated_at: generatedAt,
        },
        { onConflict: "system_user_id,device_id" }
      );

      if (syncResult.error) throw syncResult.error;
    }

    return NextResponse.json({
      generatedAt,
      memberCount: members.length,
      rosterHash,
      members,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not build the offline member roster." },
      { status: 500 }
    );
  }
}
