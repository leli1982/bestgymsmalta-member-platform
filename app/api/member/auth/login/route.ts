import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { setMemberSessionCookie } from "@/lib/memberAuth";
import { normalizeMembershipNumber } from "@/lib/memberNumberCore";

export const dynamic = "force-dynamic";

function publicMember(member: any) {
  return {
    id: member.id,
    username: member.username || "",
    memberNumber: member.member_number || "",
    fullName: member.full_name || "",
    email: member.email || "",
    phone: member.phone || "",
    status: member.status || "active",
    membershipExpiry: member.membership_expiry || "",
    tempPasswordMustChange: Boolean(member.temp_password_must_change),
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const rawLogin = String(body.login || "").trim();
    const login = rawLogin.toLowerCase();
    const password = String(body.password || "");

    if (!rawLogin || !password) {
      return NextResponse.json(
        { error: "Login and password are required." },
        { status: 400 }
      );
    }

    const usernameResult = await supabase
      .from("bgm_members")
      .select("*")
      .eq("username", login)
      .maybeSingle();

    if (usernameResult.error) throw usernameResult.error;

    let member = usernameResult.data;

    if (!member) {
      const memberNumberResult = await supabase
        .from("bgm_members")
        .select("*")
        .eq("member_number", rawLogin)
        .maybeSingle();

      if (memberNumberResult.error) throw memberNumberResult.error;
      member = memberNumberResult.data;
    }

    // Backward compatibility for legacy BGM-prefixed identifiers entered in lowercase.
    if (!member) {
      const normalizedLegacyNumber = normalizeMembershipNumber(rawLogin);

      if (normalizedLegacyNumber !== rawLogin) {
        const legacyResult = await supabase
          .from("bgm_members")
          .select("*")
          .eq("member_number", normalizedLegacyNumber)
          .maybeSingle();

        if (legacyResult.error) throw legacyResult.error;
        member = legacyResult.data;
      }
    }

    if (!member || !member.password_hash || !member.app_enrolled) {
      return NextResponse.json(
        { error: "Member account not activated yet." },
        { status: 401 }
      );
    }

    if (member.status !== "active") {
      return NextResponse.json(
        { error: "This membership is inactive. Please renew at reception." },
        { status: 403 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (member.membership_expiry && member.membership_expiry < today) {
      return NextResponse.json(
        { error: "This membership has expired. Please renew at reception." },
        { status: 403 }
      );
    }

    const passwordOk = await bcrypt.compare(password, member.password_hash);

    if (!passwordOk) {
      return NextResponse.json(
        { error: "Incorrect login or password." },
        { status: 401 }
      );
    }

    await supabase
      .from("bgm_members")
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    const response = NextResponse.json({
      member: publicMember(member),
    });

    return setMemberSessionCookie(response, String(member.id));
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}
