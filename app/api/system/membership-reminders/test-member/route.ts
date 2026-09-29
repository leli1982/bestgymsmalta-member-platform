import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMembershipReminderEmail } from "@/lib/membershipReminderMailer";
import { sendMemberMembershipReminderPush } from "@/lib/memberPushNotifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEST_MEMBER_ID = "3960a4b3-0459-4b8a-bd9d-42bc0aaa9d38";
const TEST_MEMBER_NUMBER = "BGM0000007";
const TEST_SUPABASE_URL = "https://vlvyqdjhzdcxatilbdiv.supabase.co";

function assertTestPreviewOnly() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "feature/tablet-enrollment-membership-settings" ||
    supabaseUrl !== TEST_SUPABASE_URL
  ) {
    throw new Error("This reminder test action is available only on the BGM TEST Preview.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    assertTestPreviewOnly();

    const body = await request.json().catch(() => ({}));
    const channel = String(body.channel || "").toLowerCase();
    if (channel !== "email" && channel !== "push") {
      return NextResponse.json({ error: "Channel must be email or push." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const memberResult = await supabase
      .from("bgm_members")
      .select("id,member_number,full_name,email,membership_expiry,app_enrolled")
      .eq("id", TEST_MEMBER_ID)
      .eq("member_number", TEST_MEMBER_NUMBER)
      .maybeSingle();

    if (memberResult.error) throw memberResult.error;
    const member = memberResult.data;
    if (!member) return NextResponse.json({ error: "TEST member not found." }, { status: 404 });
    if (member.membership_expiry !== "2026-10-06") {
      return NextResponse.json({ error: "TEST member expiry is not set to the expected one-week test date." }, { status: 409 });
    }

    if (channel === "email") {
      if (!member.email) return NextResponse.json({ error: "TEST member has no email." }, { status: 409 });
      await sendMembershipReminderEmail({
        recipient: member.email,
        memberName: member.full_name || TEST_MEMBER_NUMBER,
        expiryDate: member.membership_expiry,
        daysBefore: 7,
      });
      return NextResponse.json({ ok: true, channel: "email", memberNumber: TEST_MEMBER_NUMBER });
    }

    const pushResult = await sendMemberMembershipReminderPush({
      memberId: TEST_MEMBER_ID,
      expiryDate: member.membership_expiry,
      daysBefore: 7,
    });
    if (pushResult.status !== "sent") {
      return NextResponse.json({ error: pushResult.status === "not_available" ? "No active push subscription exists for BGM0000007." : "Push delivery failed.", details: pushResult }, { status: 409 });
    }
    return NextResponse.json({ ok: true, channel: "push", memberNumber: TEST_MEMBER_NUMBER, details: pushResult });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reminder test failed." }, { status: 500 });
  }
}
