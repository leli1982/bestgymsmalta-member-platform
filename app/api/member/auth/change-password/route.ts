import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getMemberRequestSession } from "@/lib/memberAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = getMemberRequestSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Member session required. Please log in again." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Choose a new password different from your current password." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("id,password_hash")
      .eq("id", session.memberId)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;
    if (!memberResult.data?.password_hash) {
      return NextResponse.json(
        { error: "Member account password is not available. Use Forgot Password instead." },
        { status: 409 }
      );
    }

    const currentOk = await bcrypt.compare(
      currentPassword,
      memberResult.data.password_hash
    );

    if (!currentOk) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date().toISOString();

    const updateResult = await supabase
      .from("bgm_members")
      .update({
        password_hash: passwordHash,
        temp_password_must_change: false,
        updated_at: updatedAt,
      })
      .eq("id", session.memberId);

    if (updateResult.error) throw updateResult.error;

    // A successful password change invalidates any outstanding reset links.
    const resetResult = await supabase
      .from("bgm_member_password_resets")
      .update({ used_at: updatedAt })
      .eq("member_id", session.memberId)
      .is("used_at", null);

    if (resetResult.error) throw resetResult.error;

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not change password." },
      { status: 500 }
    );
  }
}
