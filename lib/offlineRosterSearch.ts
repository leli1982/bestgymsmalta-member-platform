import type { OfflineRosterMember } from "@/lib/offlineRosterCore";

export function filterOfflineRoster(
  members: OfflineRosterMember[],
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return members;

  return members.filter((member) => {
    return (
      member.memberNumber.toLowerCase().includes(normalized) ||
      member.fullName.toLowerCase().includes(normalized)
    );
  });
}

export type OfflineRosterAgeState = "current" | "old" | "very_old";

export function offlineRosterAgeState(
  generatedAt: string,
  now = Date.now()
): OfflineRosterAgeState {
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated)) return "very_old";

  const ageHours = Math.max(0, (now - generated) / (60 * 60 * 1000));
  if (ageHours <= 24) return "current";
  if (ageHours <= 72) return "old";
  return "very_old";
}
