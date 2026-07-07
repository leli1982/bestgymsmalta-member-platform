import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESET_COOLDOWN_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 60;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail({
  to,
  name,
  link,
}: {
  to: string;
  name: string;
  link: string;
}) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const from =
    process.env.GMAIL_FROM ||
    `BestGymsMalta <${process.env.GMAIL_USER || "bgm.members.app@gmail.com"}>`;

  if (!user || !pass) {
    throw new Error("Missing Gmail SMTP settings.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your BestGymsMalta app password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Reset your BestGymsMalta app password</h2>
        <p>Hi ${name || "there"},</p>
        <p>We received a request to reset your BestGymsMalta app password.</p>
        <p>
          <a href="${link}" style="display:inline-block;background:#fcb415;color:#000;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p style="color:#666;font-size:13px;">BestGymsMalta</p>
      </div>
    `,
    text: `Reset your BestGymsMalta app password: ${link}\n\nThis link expires in 1 hour.`,
  });
}

export async function POST(request: NextRequest) {
  const genericResponse = {
    message: "If that email is registered, we have sent a password reset link.",
  };

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(genericResponse);
    }

    const memberResult = await supabase
      .from("bgm_members")
      .select("id, email, full_name, app_enrolled, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;

    const member = memberResult.data;

    if (member?.id && member.app_enrolled && member.password_hash) {
      const cooldownStartedAt = new Date(
        Date.now() - RESET_COOLDOWN_MINUTES * 60 * 1000
      ).toISOString();

      const recentResetResult = await supabase
        .from("bgm_member_password_resets")
        .select("id, created_at")
        .eq("member_id", String(member.id))
        .gte("created_at", cooldownStartedAt)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentResetResult.error) throw recentResetResult.error;

      const recentReset = recentResetResult.data?.[0];

      if (recentReset) {
        console.log("Password reset blocked by cooldown for:", member.email);
        return NextResponse.json(genericResponse);
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(
        Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
      ).toISOString();

      const insertResult = await supabase
        .from("bgm_member_password_resets")
        .insert({
          member_id: String(member.id),
          token_hash: tokenHash,
          expires_at: expiresAt,
        });

      if (insertResult.error) throw insertResult.error;

      const url = new URL(request.url);
      const origin = `${url.protocol}//${url.host}`;
      const resetLink = `${origin}/reset-password?token=${encodeURIComponent(
        token
      )}`;

      console.log("Sending password reset email through Gmail to:", member.email);

      await sendResetEmail({
        to: member.email,
        name: member.full_name || "",
        link: resetLink,
      });

      console.log("Password reset email sent through Gmail to:", member.email);
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json(genericResponse);
  }
}
