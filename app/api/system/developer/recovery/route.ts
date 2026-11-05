import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveOperationsMailConfig } from "@/lib/operationsMailConfig";
import {
  createDeveloperRecoveryToken, developerRecoveryBaseUrl,
  hashDeveloperRecoveryToken, validDeveloperPassword, validDeveloperRecoveryToken,
} from "@/lib/developerRecoveryCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const generic = { message: "If developer recovery is configured, instructions will be sent to the registered address." };
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    }
    const mode = String(body.mode || "");
    if (mode === "request") {
      const destination = String(process.env.BGM_DEVELOPER_RECOVERY_EMAIL || "").trim();
      const baseUrl = developerRecoveryBaseUrl(process.env);
      const mail = resolveOperationsMailConfig({
        GMAIL_USER: process.env.GMAIL_USER,
        GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
        GMAIL_FROM: process.env.GMAIL_FROM,
      });
      if (!destination || !baseUrl || !mail) {
        console.error("Developer recovery is not fully configured.");
        return NextResponse.json(generic, { headers: noStore });
      }

      const db = getSupabaseAdmin();
      const account = await db.from("bgm_system_users")
        .select("id").eq("is_protected_developer", true).eq("active", true).maybeSingle();
      if (account.error) throw account.error;
      if (!account.data) return NextResponse.json(generic, { headers: noStore });

      const recent = await db.from("bgm_developer_password_resets")
        .select("token_hash", { count: "exact", head: true })
        .eq("system_user_id", account.data.id)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
      if (recent.error) throw recent.error;
      if ((recent.count || 0) >= 3) return NextResponse.json(generic, { headers: noStore });

      const { token, tokenHash } = createDeveloperRecoveryToken();
      const issued = await db.from("bgm_developer_password_resets").insert({
        token_hash: tokenHash, system_user_id: account.data.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      if (issued.error) throw issued.error;

      const link = baseUrl + "/staff/developer-recovery?token=" + encodeURIComponent(token);
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com", port: 465, secure: true,
          auth: { user: mail.user, pass: mail.appPassword },
        });
        await transporter.sendMail({
          from: mail.from, to: destination,
          subject: "BestGymsMalta — Developer account password recovery",
          text: "A password reset was requested for the protected BestGymsMalta Developer account.\n\n" +
            "Use this single-use link within 15 minutes:\n" + link +
            "\n\nIf you did not request this, ignore this email. Ordinary Super Admins cannot reset this account.",
        });
      } catch (mailError) {
        console.error("Developer recovery mail send failed", mailError);
        // Do not log reset tokens or expose delivery/configuration status publicly.
        const revoked = await db.from("bgm_developer_password_resets")
          .update({ used_at: new Date().toISOString() }).eq("token_hash", tokenHash);
        if (revoked.error) console.error("Could not invalidate failed recovery token", revoked.error);
      }
      return NextResponse.json(generic, { headers: noStore });
    }

    if (mode === "reset") {
      const token = body.token;
      const password = body.password;
      if (!validDeveloperRecoveryToken(token) || !validDeveloperPassword(password)) {
        return NextResponse.json({ error: "Invalid reset link or password. Use at least 14 characters." }, { status: 400, headers: noStore });
      }
      const hash = await bcrypt.hash(password, 12);
      const db = getSupabaseAdmin();
      const result = await db.rpc("bgm_consume_developer_password_reset", {
        p_token_hash: hashDeveloperRecoveryToken(token),
        p_password_hash: hash,
      });
      if (result.error) throw result.error;
      if (result.data !== true) {
        return NextResponse.json({ error: "Recovery link is expired or already used. Request a new link." }, { status: 400, headers: noStore });
      }
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    return NextResponse.json({ error: "Invalid recovery action." }, { status: 400, headers: noStore });
  } catch (error) {
    console.error("Developer recovery request failed", error);
    return NextResponse.json({ error: "Recovery is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
