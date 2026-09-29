import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { MEMBER_PROFILE_COLUMNS, publicMemberProfile } from "@/lib/memberPublicProfile";
import { isCancellationEffective } from "@/lib/memberCancellationCore";
import { todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getMemberRequestSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Member session required. Please log in again." },
        { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select(MEMBER_PROFILE_COLUMNS)
      .eq("id", session.memberId)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;
    if (!memberResult.data) {
      return NextResponse.json({ error: "Member account not found." }, { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }

    if (memberResult.data.status === "archived") {
      return NextResponse.json({ error: "This member account is archived." },
        { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }

    const credentialsResult = await supabase
      .from("bgm_member_card_credentials")
      .select("barcode_value, status, activated_at, updated_at")
      .eq("member_id", session.memberId)
      .order("updated_at", { ascending: false });

    if (credentialsResult.error) throw credentialsResult.error;

    const credentialRows = credentialsResult.data || [];
    const activeCredential = credentialRows.find(
      (credential) => credential.status === "active"
    );

    // Imported legacy members keep their current physical card in the Scan3
    // claim table until reception replaces it with a modern credential.
    let legacyCardBarcode: string | null = null;
    if (!activeCredential) {
      const legacyClaimResult = await supabase
        .from("bgm_legacy_card_claims")
        .select("scan3")
        .eq("member_id", session.memberId)
        .eq("assignment_status", "active")
        .maybeSingle();
      if (legacyClaimResult.error) throw legacyClaimResult.error;
      legacyCardBarcode =
        String(legacyClaimResult.data?.scan3 || "").trim() || null;
    }

    const currentCardBarcode =
      activeCredential?.barcode_value || legacyCardBarcode || null;
    const memberNumber = String(memberResult.data.member_number || "").trim();
    if (!/^BGM[0-9]{7}$/.test(memberNumber)) {
      throw new Error("Member is missing a permanent BGM membership number.");
    }

    return NextResponse.json(
      {
        member: publicMemberProfile(memberResult.data),
        // The app barcode encodes the CURRENT active physical card, not the lifetime BGM number.
        // Staff reception can still look up the permanent member number separately.
        cardBarcode: currentCardBarcode,
        cardLinked: Boolean(currentCardBarcode),
        physicalCardBarcode: currentCardBarcode,
        source: activeCredential
          ? "physical_card"
          : legacyCardBarcode
            ? "legacy_card_claim"
            : null,
        memberStatus: isCancellationEffective(memberResult.data.cancellation_effective_date, todayMaltaDate()) ? "inactive" : memberResult.data.status,
        membershipExpiry: memberResult.data.membership_expiry || null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not load the current membership card." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}
