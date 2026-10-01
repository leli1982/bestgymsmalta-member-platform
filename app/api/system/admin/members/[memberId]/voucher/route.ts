import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMemberRefundAlertEmail } from "@/lib/memberRefundMailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { memberId } = await params;
    if (!UUID.test(memberId)) {
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    }

    const body = await request.json();
    const membershipId = String(body?.membershipId || "").trim();
    const expectedApplicationUpdatedAt = String(body?.expectedApplicationUpdatedAt || "").trim();
    const voucherCode = String(body?.voucherCode || "").trim().toUpperCase();

    if (!UUID.test(membershipId) || !voucherCode || !expectedApplicationUpdatedAt
      || !Number.isFinite(Date.parse(expectedApplicationUpdatedAt))) {
      return NextResponse.json(
        { error: "Reload the member and choose a valid voucher before saving." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const result = await db.rpc("bgm_super_admin_apply_member_voucher", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_membership_id: membershipId,
      p_expected_application_updated_at: expectedApplicationUpdatedAt,
      p_voucher_code: voucherCode,
    });

    if (result.error) {
      const message = String(result.error.message || "");
      if (/changed since you opened|reload before/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 409, headers: noStore });
      }
      if (/Super Admin access required/i.test(message)) {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403, headers: noStore });
      }
      if (/Member not found|Membership not found|payment application was not found/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 404, headers: noStore });
      }
      if (/Shared memberships|does not belong|activated membership|complete price snapshot|recorded payment receipt|Voucher is unavailable|would not create a refund|Choose a voucher/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400, headers: noStore });
      }
      console.error(result.error);
      return NextResponse.json({ error: "Could not apply the voucher. No change was confirmed." }, { status: 500, headers: noStore });
    }

    const data = result.data || {};
    if (data.changed !== true || !data.alertId) {
      return NextResponse.json({ ok: true, changed: false, refundDueCents: 0 }, { headers: noStore });
    }

    const alertResult = await db
      .from("bgm_member_refund_alerts")
      .select("id,member_first_name,member_last_name,member_id_number,member_mobile,voucher_code,voucher_percentage,refund_due_cents,currency")
      .eq("id", data.alertId)
      .single();

    if (alertResult.error) throw alertResult.error;
    const alert = alertResult.data;

    const settingsResult = await db
      .from("bgm_notification_settings")
      .select("orders_email,email_enabled")
      .eq("id", "orders")
      .maybeSingle();

    let emailNotificationStatus: "sent" | "failed" | "disabled" =
      settingsResult.data?.email_enabled ? "failed" : "disabled";
    let emailError: string | null = null;
    let emailSentAt: string | null = null;

    if (settingsResult.data?.email_enabled) {
      try {
        await sendMemberRefundAlertEmail({
          recipient: settingsResult.data.orders_email || "",
          firstName: alert.member_first_name || "",
          lastName: alert.member_last_name || "",
          idNumber: alert.member_id_number || "",
          mobile: alert.member_mobile || "",
          voucherCode: alert.voucher_code,
          voucherPercentage: alert.voucher_percentage,
          refundDueCents: alert.refund_due_cents,
          currency: alert.currency || "EUR",
        });
        emailNotificationStatus = "sent";
        emailSentAt = new Date().toISOString();
      } catch (mailError) {
        emailNotificationStatus = "failed";
        emailError = mailError instanceof Error ? mailError.message.slice(0, 500) : "Email delivery failed.";
        console.error("Member refund alert email failed:", mailError);
      }
    }

    const notificationUpdate = await db
      .from("bgm_member_refund_alerts")
      .update({
        email_notification_status: emailNotificationStatus,
        email_notification_sent_at: emailSentAt,
        email_notification_error: emailError,
      })
      .eq("id", alert.id);

    if (notificationUpdate.error) {
      console.error("Could not record refund email notification result:", notificationUpdate.error);
    }

    return NextResponse.json({
      ok: true,
      changed: true,
      alertId: alert.id,
      refundDueCents: alert.refund_due_cents,
      voucherCode: alert.voucher_code,
      voucherPercentage: alert.voucher_percentage,
      emailNotificationStatus,
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not apply voucher correction." }, { status: 500, headers: noStore });
  }
}
