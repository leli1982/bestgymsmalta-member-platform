import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getMemberRequestSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Member session required. Please log in again." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("id, member_number, status, membership_expiry")
      .eq("id", session.memberId)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;
    if (!memberResult.data) {
      return NextResponse.json({ error: "Member account not found." }, { status: 404 });
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
    const legacyBarcode =
      credentialRows.length === 0
        ? String(memberResult.data.member_number || "").trim()
        : "";
    const cardBarcode = String(
      activeCredential?.barcode_value || legacyBarcode || ""
    );
    const cardLinked = Boolean(cardBarcode);

    return NextResponse.json(
      {
        cardLinked,
        cardBarcode: cardLinked ? cardBarcode : null,
        source: activeCredential ? "credential" : legacyBarcode ? "legacy" : null,
        memberStatus: memberResult.data.status,
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
      { status: 500 }
    );
  }
}
