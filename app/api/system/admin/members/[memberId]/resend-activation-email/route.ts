import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLegacyActivationConfirmationEmail } from "@/lib/welcomeMailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;
const ACTION = "member.legacy_activation_email.resent";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!uuidPattern.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400, headers: noStore });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "confirmedMemberNumber,expectedUpdatedAt"
      || typeof body.expectedUpdatedAt !== "string"
      || !Number.isFinite(Date.parse(body.expectedUpdatedAt))
      || typeof body.confirmedMemberNumber !== "string") {
      return NextResponse.json({ error: "Reload the member and confirm the member number." }, { status: 400, headers: noStore });
    }
    const db = getSupabaseAdmin();
    const { data: member, error: memberError } = await db.from("bgm_members")
      .select("id,member_number,full_name,email,legacy_pk_customer,app_enrolled,password_hash,updated_at")
      .eq("id", memberId).maybeSingle();
    if (memberError) throw memberError;
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404, headers: noStore });
    if (member.updated_at !== body.expectedUpdatedAt || member.member_number !== body.confirmedMemberNumber) {
      return NextResponse.json({ error: "Member details changed. Reload before resending." }, { status: 409, headers: noStore });
    }
    if (!member.legacy_pk_customer || member.app_enrolled !== true || !member.password_hash) {
      return NextResponse.json({ error: "Only activated legacy accounts can receive this confirmation." }, { status: 400, headers: noStore });
    }
    const recipient = String(member.email || "").trim().toLowerCase();
    if (!emailPattern.test(recipient) || recipient.length > 254) {
      return NextResponse.json({ error: "A valid saved member email address is required." }, { status: 400, headers: noStore });
    }
    const { data: recent, error: auditReadError } = await db.from("bgm_audit_log")
      .select("created_at").eq("action_key", ACTION).eq("member_id", memberId)
      .gte("created_at", new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString())
      .order("created_at", { ascending: false }).limit(1);
    if (auditReadError) throw auditReadError;
    if ((recent || []).length > 0) return NextResponse.json({
      error: "An activation email was resent recently. Try again after five minutes."
    }, { status: 429, headers: noStore });

    // The recipient is loaded exclusively from the database.
    await sendLegacyActivationConfirmationEmail({
      recipient, memberName: String(member.full_name || ""), memberNumber: String(member.member_number || ""),
      appUrl: "https://bestgymsmalta-member-platform.vercel.app/login",
    });
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId, staff_name: auth.context.displayName,
      action_key: ACTION, entity_type: "member", entity_id: memberId, member_id: memberId,
      after_data: { memberNumber: member.member_number, recipient,
        sentAt: new Date().toISOString(), kind: "legacy_activation_confirmation" },
    });
    if (audit.error) console.error("Activation email accepted but resend audit failed.", audit.error);
    return NextResponse.json({ sent: true, auditRecorded: !audit.error }, { headers: noStore });
  } catch (error) {
    console.error("Super Admin legacy activation email resend failed.", error);
    return NextResponse.json({ error: "Could not send activation confirmation. No member data was changed." },
      { status: 502, headers: noStore });
  }
}
