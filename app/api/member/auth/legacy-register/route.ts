import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { setMemberSessionCookie } from "@/lib/memberAuth";
import {
  normalizeLegacyEmail,
  resolveLegacyMemberCandidate,
  type LegacyMemberCandidate,
} from "@/lib/legacyMemberActivationCore";

export const dynamic = "force-dynamic";

function publicMember(member: any) {
  return {
    id: member.id,
    username: member.username || "",
    memberNumber: member.member_number || "",
    fullName: member.full_name || "",
    email: member.email || "",
    phone: member.phone || member.mobile || "",
    status: member.status || "active",
    membershipExpiry: member.membership_expiry || "",
    tempPasswordMustChange: Boolean(member.temp_password_must_change),
  };
}

function genericIdentityError() {
  return NextResponse.json(
    { error: "We could not verify those legacy membership details." },
    { status: 404 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const legacyPk = String(body.legacyPk || "").trim();
    const email = normalizeLegacyEmail(body.email);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const mobile = String(body.mobile || "").trim();

    if (!legacyPk || !email || !username || !password) {
      return NextResponse.json(
        { error: "Old membership number, email, username and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const candidatesResult = await supabase
      .from("bgm_members")
      .select("id, member_number, full_name, email, phone, mobile, date_of_birth, status, app_enrolled, membership_expiry, username, temp_password_must_change")
      .eq("legacy_pk_customer", legacyPk)
      .limit(20);

    if (candidatesResult.error) throw candidatesResult.error;

    const candidates = (candidatesResult.data || []) as LegacyMemberCandidate[];
    if (candidates.length === 0) return genericIdentityError();

    const resolution = resolveLegacyMemberCandidate(candidates, {
      email,
      dateOfBirth,
      mobile,
    });

    if (resolution.kind === "needs_identity_check") {
      return NextResponse.json(
        {
          needsIdentityCheck: true,
          error: "We found a legacy membership without an email. Enter the member's date of birth and mobile number to verify the record and save this email.",
        },
        { status: 409 }
      );
    }

    if (resolution.kind !== "matched") return genericIdentityError();

    const member = resolution.member as any;

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
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      username,
      password_hash: passwordHash,
      app_enrolled: true,
      temp_password_must_change: false,
      last_login_at: now,
      updated_at: now,
    };

    if (resolution.shouldUpdateEmail) {
      updatePayload.email = email;
    }

    const updateResult = await supabase
      .from("bgm_members")
      .update(updatePayload)
      .eq("id", member.id)
      .select("*")
      .single();

    if (updateResult.error) throw updateResult.error;

    const response = NextResponse.json({
      member: publicMember(updateResult.data),
      recoveredMemberNumber: String(updateResult.data.member_number || ""),
      emailUpdated: resolution.shouldUpdateEmail,
    });

    return setMemberSessionCookie(response, String(updateResult.data.id));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not activate legacy member account." },
      { status: 500 }
    );
  }
}
