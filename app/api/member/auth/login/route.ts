import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const login = String(body.login || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!login || !password) {
      return NextResponse.json(
        { error: "Login and password are required." },
        { status: 400 }
      );
    }

    const result = await supabase
      .from("bgm_members")
      .select("*")
      .or(
        `username.eq.${login},email.eq.${login},member_number.eq.${login.toUpperCase()}`
      )
      .maybeSingle();

    if (result.error) throw result.error;

    const member = result.data;

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

    return NextResponse.json({
      member: publicMember(member),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}
