import {
  enabledMembershipReminderDays,
  addCalendarDays,
  type MembershipReminderDays,
  type MembershipReminderSettings,
} from "@/lib/membershipReminderCore";
import { sendMembershipReminderEmail } from "@/lib/membershipReminderMailer";
import { sendMemberMembershipReminderPush } from "@/lib/memberPushNotifications";
import { createMemberNotification } from "@/lib/memberNotifications";
import { buildMembershipReminderPush } from "@/lib/membershipReminderCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ReminderMember = {
  id: string;
  member_number: string | null;
  full_name: string | null;
  email: string | null;
  status: string | null;
  membership_expiry: string | null;
  cancellation_effective_date: string | null;
  archived_at: string | null;
  app_enrolled: boolean | null;
};

export type MembershipReminderRunSummary = {
  enabled: boolean;
  businessDate: string;
  intervals: number[];
  candidates: number;
  email: { sent: number; skipped: number; failed: number };
  push: { sent: number; skipped: number; failed: number };
};

export async function loadMembershipReminderSettings(): Promise<MembershipReminderSettings> {
  const supabase = getSupabaseAdmin();
  const result = await supabase
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

function targetExpiryDate(today: string, daysBefore: MembershipReminderDays): string {
  // "1 month" is represented by the 30-day setting key. Keep its business
  // meaning as one calendar month rather than a fixed 30 x 24 hours.
  if (daysBefore !== 30) return addCalendarDays(today, daysBefore);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) throw new Error("A valid Malta business date is required.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetMonthStart = new Date(Date.UTC(year, month, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

async function loadCandidates(expiryDate: string): Promise<ReminderMember[]> {
  const supabase = getSupabaseAdmin();
  const rows: ReminderMember[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("bgm_members")
      .select("id,member_number,full_name,email,status,membership_expiry,cancellation_effective_date,archived_at,app_enrolled")
      .eq("status", "active")
      .is("archived_at", null)
      .eq("membership_expiry", expiryDate)
      .is("cancellation_effective_date", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    const page = (result.data || []) as ReminderMember[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function claimReminder(input: {
  memberId: string;
  expiryDate: string;
  daysBefore: MembershipReminderDays;
  channel: "email" | "push";
}) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bgm_membership_reminder_log")
    .insert({
      member_id: input.memberId,
      membership_expiry: input.expiryDate,
      days_before: input.daysBefore,
      channel: input.channel,
      status: "pending",
      attempted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (result.error) {
    if (result.error.code === "23505") return null;
    throw result.error;
  }
  return result.data.id as string;
}

async function finishReminder(
  id: string,
  status: "sent" | "skipped" | "failed",
  values?: { reason?: string | null; errorText?: string | null },
) {
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("bgm_membership_reminder_log")
    .update({
      status,
      reason: values?.reason || null,
      error_text: values?.errorText || null,
      sent_at: status === "sent" ? now : null,
      updated_at: now,
    })
    .eq("id", id);
  if (result.error) throw result.error;
}

async function processMember(
  member: ReminderMember,
  daysBefore: MembershipReminderDays,
  settings: MembershipReminderSettings,
  summary: MembershipReminderRunSummary,
) {
  const expiryDate = member.membership_expiry;
  if (!expiryDate) return;

  const inAppPayload = buildMembershipReminderPush({ expiryDate, daysBefore });
  await createMemberNotification({
    memberId: member.id,
    type: "membership_expiry",
    title: inAppPayload.title,
    body: inAppPayload.body,
    href: "/member-login",
    dedupeKey: `membership-expiry:${expiryDate}:${daysBefore}`,
  });

  if (settings.emailEnabled) {
    const logId = await claimReminder({
      memberId: member.id,
      expiryDate,
      daysBefore,
      channel: "email",
    });

    if (logId) {
      const email = String(member.email || "").trim();
      if (!email || !EMAIL_PATTERN.test(email)) {
        await finishReminder(logId, "skipped", { reason: "no_usable_email" });
        summary.email.skipped += 1;
      } else {
        try {
          await sendMembershipReminderEmail({
            recipient: email,
            memberName: String(member.full_name || member.member_number || "Member"),
            expiryDate,
            daysBefore,
          });
          await finishReminder(logId, "sent");
          summary.email.sent += 1;
        } catch (error) {
          await finishReminder(logId, "failed", {
            errorText: error instanceof Error ? error.message.slice(0, 1000) : "Unknown email error",
          });
          summary.email.failed += 1;
        }
      }
    }
  }

  if (settings.pushEnabled) {
    const logId = await claimReminder({
      memberId: member.id,
      expiryDate,
      daysBefore,
      channel: "push",
    });

    if (logId) {
      if (member.app_enrolled !== true) {
        await finishReminder(logId, "skipped", { reason: "app_not_activated" });
        summary.push.skipped += 1;
      } else {
        try {
          const pushResult = await sendMemberMembershipReminderPush({
            memberId: member.id,
            expiryDate,
            daysBefore,
          });

          if (pushResult.status === "not_available") {
            await finishReminder(logId, "skipped", { reason: "no_push_subscription" });
            summary.push.skipped += 1;
          } else if (pushResult.status === "sent") {
            await finishReminder(logId, "sent");
            summary.push.sent += 1;
          } else {
            await finishReminder(logId, "failed", { errorText: "All active push subscriptions failed." });
            summary.push.failed += 1;
          }
        } catch (error) {
          await finishReminder(logId, "failed", {
            errorText: error instanceof Error ? error.message.slice(0, 1000) : "Unknown push error",
          });
          summary.push.failed += 1;
        }
      }
    }
  }
}

async function runInChunks<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

export async function runMembershipExpiryReminders(
  now = new Date(),
): Promise<MembershipReminderRunSummary> {
  const settings = await loadMembershipReminderSettings();
  const businessDate = todayMaltaDate(now);
  const intervals = enabledMembershipReminderDays(settings);

  const summary: MembershipReminderRunSummary = {
    enabled: settings.enabled,
    businessDate,
    intervals: [...intervals],
    candidates: 0,
    email: { sent: 0, skipped: 0, failed: 0 },
    push: { sent: 0, skipped: 0, failed: 0 },
  };

  if (!settings.enabled || (!settings.emailEnabled && !settings.pushEnabled) || !intervals.length) {
    return summary;
  }

  for (const daysBefore of intervals) {
    const expiryDate = targetExpiryDate(businessDate, daysBefore);
    const candidates = await loadCandidates(expiryDate);
    summary.candidates += candidates.length;
    await runInChunks(candidates, 10, (member) =>
      processMember(member, daysBefore, settings, summary),
    );
  }

  return summary;
}
