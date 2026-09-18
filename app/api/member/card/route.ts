import { NextRequest, NextResponse } from "next/server";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { MEMBER_PROFILE_COLUMNS, publicMemberProfile } from "@/lib/memberPublicProfile";

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
    const memberNumber = String(memberResult.data.member_number || "").trim();
    if (!/^BGM[0-9]{7}$/.test(memberNumber)) {
      throw new Error("Member is missing a permanent BGM membership number.");
    }

    return NextResponse.json(
      {
        member: publicMemberProfile(memberResult.data),
        // The member-app barcode is the lifetime BGM member number.
        cardBarcode: memberNumber,
        // The preprinted physical card remains a separate replaceable credential.
        cardLinked: Boolean(activeCredential),
        physicalCardBarcode: activeCredential?.barcode_value || null,
        source: "member_number",
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
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}
