import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token || !password) {
      return NextResponse.json(
        { error: "Reset token and new password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    const resetResult = await supabase
      .from("bgm_member_password_resets")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .maybeSingle();

    if (resetResult.error) throw resetResult.error;

    const reset = resetResult.data;

    if (!reset) {
      return NextResponse.json(
        { error: "This reset link is invalid or has already been used." },
        { status: 400 }
      );
    }

    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const memberUpdate = await supabase
      .from("bgm_members")
      .update({
        password_hash: passwordHash,
        temp_password_must_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reset.member_id);

    if (memberUpdate.error) throw memberUpdate.error;

    await supabase
      .from("bgm_member_password_resets")
      .update({
        used_at: new Date().toISOString(),
      })
      .eq("member_id", reset.member_id)
      .is("used_at", null);

    return NextResponse.json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Could not reset password." },
      { status: 500 }
    );
  }
}
