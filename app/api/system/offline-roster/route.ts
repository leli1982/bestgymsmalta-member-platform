import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  hashOfflineRoster,
  toOfflineRosterMember,
} from "@/lib/offlineRosterCore";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;
type OfflineMemberRow = {
  id: string;
  member_number: string | null;
  full_name: string | null;
};
type ModernCardRow = {
  member_id: string;
  barcode_value: string | null;
};
type LegacyCardRow = {
  member_id: string;
  scan3: string | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchAllActiveMembers(supabase: SupabaseAdmin) {
  const rows: OfflineMemberRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bgm_members")
      .select("id, member_number, full_name")
      .eq("status", "active")
      .or(`membership_expiry.is.null,membership_expiry.gte.${todayString()}`)
      .order("member_number", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as OfflineMemberRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllModernCards(supabase: SupabaseAdmin) {
  const rows: ModernCardRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bgm_member_card_credentials")
      .select("member_id, barcode_value")
      .eq("status", "active")
      .order("member_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as ModernCardRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllLegacyCards(supabase: SupabaseAdmin) {
  const rows: LegacyCardRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bgm_legacy_card_claims")
      .select("member_id, scan3")
      .eq("assignment_status", "active")
      .order("member_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as LegacyCardRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "offline_roster.view");
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const [memberRows, modernCardRows, legacyCardRows] = await Promise.all([
      fetchAllActiveMembers(supabase),
      fetchAllModernCards(supabase),
      fetchAllLegacyCards(supabase),
    ]);

    const cardsByMember = new Map<string, string[]>();
    const addCard = (memberId: unknown, cardValue: unknown) => {
      const id = String(memberId || "").trim();
      const card = String(cardValue || "").trim();
      if (!id || !card) return;
      const current = cardsByMember.get(id) || [];
      if (!current.includes(card)) current.push(card);
      cardsByMember.set(id, current);
    };

    for (const card of modernCardRows) {
      addCard(card.member_id, card.barcode_value);
    }
    for (const claim of legacyCardRows) {
      addCard(claim.member_id, claim.scan3);
    }

    const members = memberRows
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
