import { addCalendarDays } from "@/lib/membershipReminderCore";
import {
  attendanceDatesFromCheckins,
  buildInactivityEvent,
  buildStreakEvent,
  evaluateMotivationalEligibility,
  type EngagementEvent,
} from "@/lib/memberEngagementCore";
import { createMemberNotification } from "@/lib/memberNotifications";
import { sendMemberPush } from "@/lib/memberPushNotifications";
import { maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 250;
const CHECKIN_PAGE_SIZE = 1000;
const WORK_CHUNK_SIZE = 10;
const ATTENDANCE_LOOKBACK_DAYS = 31;

type EngagementSettings = {
  enabled: boolean;
  inactivityEnabled: boolean;
  streakEnabled: boolean;
};

type EngagementMember = {
  id: string;
  status: string | null;
  membership_expiry: string | null;
  cancellation_effective_date: string | null;
  archived_at: string | null;
  app_enrolled: boolean | null;
};

type PreferenceRow = {
  member_id: string;
  motivational_enabled: boolean | null;
};

type CheckinRow = {
  id: string;
  member_id: string;
  checkin_at: string;
  source: string | null;
};

export type MemberEngagementRunSummary = {
  enabled: boolean;
  businessDate: string;
  candidates: number;
  eligible: number;
  ineligible: number;
  memberErrors: number;
  events: {
    claimed: number;
    sent: number;
    skipped: number;
    failed: number;
    duplicates: number;
  };
};

async function loadEngagementSettings(): Promise<EngagementSettings> {
  const result = await getSupabaseAdmin()
    .from("bgm_member_engagement_settings")
    .select("enabled,inactivity_enabled,streak_enabled")
    .eq("id", "member_engagement")
    .maybeSingle();
  if (result.error) throw result.error;

  const row = result.data;
  return {
    enabled: row?.enabled ?? true,
    inactivityEnabled: row?.inactivity_enabled ?? true,
    streakEnabled: row?.streak_enabled ?? true,
  };
}

async function loadMemberPage(from: number, businessDate: string): Promise<EngagementMember[]> {
  const result = await getSupabaseAdmin()
    .from("bgm_members")
    .select("id,status,membership_expiry,cancellation_effective_date,archived_at,app_enrolled")
    .eq("status", "active")
    .is("archived_at", null)
    .eq("app_enrolled", true)
    .gte("membership_expiry", businessDate)
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (result.error) throw result.error;
  return (result.data || []) as EngagementMember[];
}

async function loadPreferences(memberIds: string[]): Promise<Map<string, PreferenceRow>> {
  if (!memberIds.length) return new Map();
  const result = await getSupabaseAdmin()
    .from("bgm_member_notification_preferences")
    .select("member_id,motivational_enabled")
    .in("member_id", memberIds);
  if (result.error) throw result.error;
  return new Map(((result.data || []) as PreferenceRow[]).map((row) => [row.member_id, row]));
}

async function loadActiveSubscriptionMemberIds(memberIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!memberIds.length) return ids;
  const db = getSupabaseAdmin();

  for (let from = 0; ; from += CHECKIN_PAGE_SIZE) {
    const result = await db
      .from("bgm_member_push_subscriptions")
      .select("id,member_id")
      .in("member_id", memberIds)
      .eq("active", true)
      .order("member_id", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHECKIN_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as Array<{ id: string; member_id: string }>;
    for (const row of page) ids.add(row.member_id);
    if (page.length < CHECKIN_PAGE_SIZE) break;
  }

  return ids;
}

async function loadCanonicalCheckins(memberIds: string[], businessDate: string): Promise<CheckinRow[]> {
  if (!memberIds.length) return [];
  const db = getSupabaseAdmin();
  const lookbackDate = addCalendarDays(businessDate, -ATTENDANCE_LOOKBACK_DAYS);
  const start = maltaDayUtcRange(lookbackDate).start;
  const end = maltaDayUtcRange(businessDate).end;
  const rows: CheckinRow[] = [];

  for (let from = 0; ; from += CHECKIN_PAGE_SIZE) {
    const result = await db
      .from("bgm_member_checkins")
      .select("id,member_id,checkin_at,source")
      .in("member_id", memberIds)
      .in("source", ["qr", "nfc", "barcode"])
      .gte("checkin_at", start)
      .lt("checkin_at", end)
      .order("checkin_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHECKIN_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as CheckinRow[];
    rows.push(...page);
    if (page.length < CHECKIN_PAGE_SIZE) break;
  }

  return rows;
}

async function claimEvent(memberId: string, event: EngagementEvent): Promise<string | null> {
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("bgm_member_engagement_notification_log")
    .insert({
      member_id: memberId,
      event_type: event.eventType,
      event_key: event.eventKey,
      event_date: event.eventDate,
      status: "pending",
      attempted_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (result.error) {
    if (result.error.code === "23505") return null;
    throw result.error;
  }
  return result.data.id as string;
}

async function finishEvent(
  id: string,
  status: "sent" | "skipped" | "failed",
  values?: { reason?: string | null; errorText?: string | null },
) {
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("bgm_member_engagement_notification_log")
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

async function deliverEvent(
  memberId: string,
  event: EngagementEvent,
  summary: MemberEngagementRunSummary,
) {
  const logId = await claimEvent(memberId, event);
  if (!logId) {
    summary.events.duplicates += 1;
    return;
  }
  summary.events.claimed += 1;

  try {
    await createMemberNotification({
      memberId,
      type: `member_engagement_${event.eventType}`,
      title: event.title,
      body: event.body,
      href: event.href,
      dedupeKey: event.eventKey,
    });

    const pushResult = await sendMemberPush(memberId, {
      title: event.title,
      body: event.body,
      url: event.href,
      tag: event.eventKey,
    });

    if (pushResult.status === "sent") {
      await finishEvent(logId, "sent");
      summary.events.sent += 1;
    } else if (pushResult.status === "not_available") {
      await finishEvent(logId, "skipped", { reason: "no_push_subscription" });
      summary.events.skipped += 1;
    } else {
      await finishEvent(logId, "failed", { errorText: "All active push subscriptions failed." });
      summary.events.failed += 1;
    }
  } catch (error) {
    await finishEvent(logId, "failed", {
      errorText: error instanceof Error ? error.message.slice(0, 1000) : "Unknown engagement notification error",
    });
    summary.events.failed += 1;
  }
}

async function processMember(input: {
  member: EngagementMember;
  businessDate: string;
  settings: EngagementSettings;
  preference: PreferenceRow | undefined;
  hasActiveSubscription: boolean;
  checkins: CheckinRow[];
  summary: MemberEngagementRunSummary;
}) {
  const { member, businessDate, settings, preference, hasActiveSubscription, checkins, summary } = input;
  const eligibility = evaluateMotivationalEligibility({
    appEnrolled: member.app_enrolled === true,
    archivedAt: member.archived_at,
    status: member.status,
    membershipExpiry: member.membership_expiry,
    cancellationEffectiveDate: member.cancellation_effective_date,
    today: businessDate,
    motivationalEnabled: preference?.motivational_enabled ?? true,
    hasActiveSubscription,
  });

  if (!eligibility.eligible) {
    summary.ineligible += 1;
    return;
  }
  summary.eligible += 1;

  const attendanceDates = attendanceDatesFromCheckins(checkins);
  const events: EngagementEvent[] = [];
  if (settings.inactivityEnabled) {
    const event = buildInactivityEvent(attendanceDates, businessDate);
    if (event) events.push(event);
  }
  if (settings.streakEnabled) {
    const event = buildStreakEvent(attendanceDates, businessDate);
    if (event) events.push(event);
  }

  for (const event of events) {
    await deliverEvent(member.id, event, summary);
  }
}

async function runInChunks<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

export async function runMemberEngagementNotifications(
  now = new Date(),
): Promise<MemberEngagementRunSummary> {
  const settings = await loadEngagementSettings();
  const businessDate = todayMaltaDate(now);
  const summary: MemberEngagementRunSummary = {
    enabled: settings.enabled,
    businessDate,
    candidates: 0,
    eligible: 0,
    ineligible: 0,
    memberErrors: 0,
    events: { claimed: 0, sent: 0, skipped: 0, failed: 0, duplicates: 0 },
  };

  if (!settings.enabled || (!settings.inactivityEnabled && !settings.streakEnabled)) {
    return summary;
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const members = await loadMemberPage(from, businessDate);
    if (!members.length) break;
    summary.candidates += members.length;

    const memberIds = members.map((member) => member.id);
    const [preferences, subscriptionMemberIds, checkins] = await Promise.all([
      loadPreferences(memberIds),
      loadActiveSubscriptionMemberIds(memberIds),
      loadCanonicalCheckins(memberIds, businessDate),
    ]);

    const checkinsByMember = new Map<string, CheckinRow[]>();
    for (const checkin of checkins) {
      const rows = checkinsByMember.get(checkin.member_id) || [];
      rows.push(checkin);
      checkinsByMember.set(checkin.member_id, rows);
    }

    await runInChunks(members, WORK_CHUNK_SIZE, async (member) => {
      try {
        await processMember({
          member,
          businessDate,
          settings,
          preference: preferences.get(member.id),
          hasActiveSubscription: subscriptionMemberIds.has(member.id),
          checkins: checkinsByMember.get(member.id) || [],
          summary,
        });
      } catch (error) {
        summary.memberErrors += 1;
        console.error(`Member engagement processing failed for ${member.id}:`, error);
      }
    });

    if (members.length < PAGE_SIZE) break;
  }

  return summary;
}
