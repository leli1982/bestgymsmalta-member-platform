import { createHash } from "crypto";

export type OfflineRosterMember = {
  memberNumber: string;
  fullName: string;
  accessScope: "network" | "single_gym" | "neptunes_only";
  accessGymId: string | null;
  cardNumbers?: string[];
};

type MemberRow = {
  member_number?: string | null;
  full_name?: string | null;
  access_scope?: string | null;
  access_gym_id?: string | null;
  card_numbers?: unknown;
};

export function toOfflineRosterMember(row: MemberRow): OfflineRosterMember {
  const rawCards = Array.isArray(row.card_numbers) ? row.card_numbers : [];
  const cardNumbers = Array.from(
    new Set(rawCards.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  const accessScope = row.access_scope === "single_gym"
    ? "single_gym"
    : row.access_scope === "neptunes_only"
      ? "neptunes_only"
      : "network";
  const explicitGymId = String(row.access_gym_id || "").trim() || null;
  const accessGymId = accessScope === "network"
    ? null
    : explicitGymId || (accessScope === "neptunes_only" ? "bgm-neptunes" : null);

  return {
    memberNumber: String(row.member_number || "").trim(),
    fullName: String(row.full_name || "").trim(),
    accessScope,
    accessGymId,
    cardNumbers,
  };
}

export function hashOfflineRoster(roster: OfflineRosterMember[]) {
  return createHash("sha256").update(JSON.stringify(roster)).digest("hex");
}
