export const MEMBERSHIP_REMINDER_DAYS = [1, 7, 14, 21, 30] as const;
export type MembershipReminderDays = (typeof MEMBERSHIP_REMINDER_DAYS)[number];

export type MembershipReminderSettings = {
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  day1Enabled: boolean;
  day7Enabled: boolean;
  day14Enabled: boolean;
  day21Enabled: boolean;
  day30Enabled: boolean;
};

export function enabledMembershipReminderDays(
  settings: MembershipReminderSettings,
): MembershipReminderDays[] {
  const result: MembershipReminderDays[] = [];
  if (settings.day1Enabled) result.push(1);
  if (settings.day7Enabled) result.push(7);
  if (settings.day14Enabled) result.push(14);
  if (settings.day21Enabled) result.push(21);
  if (settings.day30Enabled) result.push(30);
  return result;
}

export function addCalendarDays(dateValue: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("A valid YYYY-MM-DD date is required.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reminderLeadLabel(daysBefore: number): string {
  if (daysBefore === 1) return "tomorrow";
  if (daysBefore === 7) return "in 1 week";
  if (daysBefore === 14) return "in 2 weeks";
  if (daysBefore === 21) return "in 3 weeks";
  if (daysBefore === 30) return "in 1 month";
  return `in ${daysBefore} days`;
}

export function formatMembershipExpiryForMember(expiry: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!match) return expiry;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function buildMembershipReminderEmail(input: {
  memberName: string;
  expiryDate: string;
  daysBefore: MembershipReminderDays;
}) {
  const name = input.memberName.trim() || "Member";
  const expiry = formatMembershipExpiryForMember(input.expiryDate);
  const lead = reminderLeadLabel(input.daysBefore);
  const subject = `BestGymsMalta membership reminder – expires ${expiry}`;
  const text = [
    `Hi ${name},`,
    "",
    `A quick reminder that your BestGymsMalta membership expires ${lead}, on ${expiry}.`,
    "Renew before it expires to keep uninterrupted access to your BestGymsMalta membership.",
    "",
    "If you have already renewed, no action is needed.",
    "",
    "BestGymsMalta",
    "Be the best... Beat the rest.",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
  <div style="max-width:620px;margin:0 auto;padding:32px 18px">
    <div style="background:#18181b;border-radius:22px;padding:28px;color:white">
      <div style="font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#ff6a1a">BestGymsMalta</div>
      <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15">Membership expiry reminder</h1>
    </div>
    <div style="background:white;border-radius:22px;padding:28px;margin-top:14px">
      <p style="margin:0 0 16px;font-size:16px">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.6">A quick reminder that your BestGymsMalta membership expires <strong>${escapeHtml(lead)}</strong>, on <strong>${escapeHtml(expiry)}</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.6">Renew before it expires to keep uninterrupted access to your BestGymsMalta membership.</p>
      <p style="margin:0;color:#71717a;font-size:14px;line-height:1.6">If you have already renewed, no action is needed.</p>
    </div>
    <p style="text-align:center;color:#71717a;font-size:12px;font-weight:700;margin:18px 0 0">Be the best... Beat the rest.</p>
  </div>
</body></html>`;
  return { subject, text, html };
}

export function buildMembershipReminderPush(input: {
  expiryDate: string;
  daysBefore: MembershipReminderDays;
}) {
  const expiry = formatMembershipExpiryForMember(input.expiryDate);
  return {
    title: "BestGymsMalta membership reminder",
    body: `Your membership expires ${reminderLeadLabel(input.daysBefore)} on ${expiry}. Renew soon to keep uninterrupted access.`,
    url: "/more",
    tag: `bgm-membership-expiry-${input.expiryDate}-${input.daysBefore}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
