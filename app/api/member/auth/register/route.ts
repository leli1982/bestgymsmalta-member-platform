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

    const memberNumber = normalizeMembershipNumber(body.memberNumber);
    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!memberNumber || !username || !password) {
      return NextResponse.json(
        { error: "Member number, username and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const memberResult = await supabase
      .from("bgm_members")
      .select("*")
      .eq("member_number", memberNumber)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;

    const member = memberResult.data;

    if (!member) {
      return NextResponse.json(
        { error: "No member found with that membership number." },
        { status: 404 }
      );
    }

    const registeredEmail = String(member.email || "").trim().toLowerCase();

    if (!registeredEmail) {
      return NextResponse.json(
        {
          error:
            "No email is registered for this membership. Please ask reception to verify and add an email before activating the app.",
        },
        { status: 409 }
      );
    }

    if (!email || email !== registeredEmail) {
      return NextResponse.json(
        { error: "No active member found with that member number and email." },
        { status: 404 }
      );
    }

    if (member.status !== "active") {
      return NextResponse.json(
        { error: "This membership is inactive. Please renew at reception." },
        { status: 403 }
      );
    }

    if (member.app_enrolled) {
      return NextResponse.json(
        { error: "This member already activated the app. Please log in." },
        { status: 409 }
      );
    }

    const usernameCheck = await supabase
      .from("bgm_members")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (usernameCheck.error) throw usernameCheck.error;

    if (usernameCheck.data?.id) {
      return NextResponse.json(
        { error: "This username is already taken." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const updateResult = await supabase
      .from("bgm_members")
      .update({
        username,
        password_hash: passwordHash,
        app_enrolled: true,
        temp_password_must_change: false,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .select("*")
      .single();

    if (updateResult.error) throw updateResult.error;

    const response = NextResponse.json({
      member: publicMember(updateResult.data),
    });

    return setMemberSessionCookie(response, String(updateResult.data.id));
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not activate member account." },
      { status: 500 }
    );
  }
}
