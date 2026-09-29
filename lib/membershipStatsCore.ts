export type ActivatedMembershipRow = {
  id: string;
  enrollment_gym_id: string;
  membership_type: string;
  activated_at: string;
};

export type MembershipStatsGym = {
  gymId: string;
  gymName: string;
  count: number;
};

export type MembershipStatsDay = { date: string; count: number };

const maltaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
});
export function maltaActivationDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid activation timestamp.");
  const parts = maltaFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

// Each activated new application is one sold membership; a couples membership
// counts once here rather than counting its two enrolled people as two sales.
export function summariseNewMemberships(
  rows: ActivatedMembershipRow[],
  gymNames: Record<string, string>,
) {
  const gymCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const typeCounts: Record<string, number> = { single: 0, couples: 0, student: 0 };
  for (const row of rows) {
    const gymId = String(row.enrollment_gym_id || "");
    const day = maltaActivationDate(row.activated_at);
    gymCounts.set(gymId, (gymCounts.get(gymId) || 0) + 1);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    const kind = String(row.membership_type || "").toLowerCase();
    typeCounts[kind] = (typeCounts[kind] || 0) + 1;
  }
  const byGym: MembershipStatsGym[] = Array.from(gymCounts.entries())
    .map(([gymId, count]) => ({ gymId, gymName: gymNames[gymId] || gymId, count }))
    .sort((a, b) => b.count - a.count || a.gymName.localeCompare(b.gymName));
  const byDay: MembershipStatsDay[] = Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    total: rows.length,
    gymsWithEnrollments: byGym.length,
    byGym,
    byDay,
    byType: typeCounts,
  };
}
