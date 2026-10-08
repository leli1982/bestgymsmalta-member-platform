import { evaluateMemberAppAccess, type MemberAppAccessResult } from "@/lib/memberAppAccessCore";
import { enabledMembershipReminderDays, type MembershipReminderSettings } from "@/lib/membershipReminderCore";
import { isCancellationEffective } from "@/lib/memberCancellationCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type MemberAccessRow = {
  status?: string | null;
  membership_expiry?: string | null;
  cancellation_effective_date?: string | null;
};

async function reminderSettings(): Promise<MembershipReminderSettings> {
  const result = await getSupabaseAdmin()
    .from("bgm_membership_reminder_settings")
    .select("enabled,email_enabled,push_enabled,day_1_enabled,day_7_enabled,day_14_enabled,day_21_enabled,day_30_enabled")
    .eq("id", "membership_expiry")
    .maybeSingle();
  if (result.error) throw result.error;
  const row = result.data;
  return {
    enabled: Boolean(row?.enabled),
    emailEnabled: row?.email_enabled !== false,
    pushEnabled: row?.push_enabled !== false,
    day1Enabled: row?.day_1_enabled !== false,
    day7Enabled: row?.day_7_enabled !== false,
    day14Enabled: row?.day_14_enabled !== false,
    day21Enabled: row?.day_21_enabled !== false,
    day30Enabled: row?.day_30_enabled !== false,
  };
}

export async function resolveMemberAppAccess(
  member: MemberAccessRow,
  now = new Date(),
): Promise<MemberAppAccessResult> {
  const today = todayMaltaDate(now);
  const cancellationEffective = isCancellationEffective(member.cancellation_effective_date, today);
  const status = String(member.status || "inactive");

  if (!member.membership_expiry) {
    return {
      state: status === "active" && !cancellationEffective ? "active" : "locked",
      daysUntilExpiry: 0,
      graceDaysRemaining: 0,
      reminderDue: false,
    };
  }

  const settings = await reminderSettings();
  const reminderDays = settings.enabled ? enabledMembershipReminderDays(settings) : [];
  return evaluateMemberAppAccess({
    today,
    status,
    membershipExpiry: member.membership_expiry,
    reminderDays,
    cancellationEffective,
  });
}
